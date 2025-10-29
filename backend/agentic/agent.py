from ast import Dict
from codeop import Compile
import re
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import N
from agentic.__base import Agent
from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import StateGraph, END, START
from typing import TypedDict, Annotated, Sequence, List
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, ToolMessage, AIMessage, SystemMessage, HumanMessage
from PIL import Image
import asyncio
import copy
from concurrent.futures import ThreadPoolExecutor
import threading
from langchain_google_genai import ChatGoogleGenerativeAI
from filter.whitelist import Whitelist
from filter.blacklist import Blacklist
from filter.personal_whitelist import PersonalWhitelist
from langchain_ollama import ChatOllama
from pathlib import Path
from urllib.parse import urlparse
import idna



class CerberusState(TypedDict): #
        # AgentState responsible for keeping the state in the graph, inner class of ReActAgent
        messages : Annotated[Sequence[BaseMessage], add_messages] # Messages field so that the agent does not forget previous tool invocations etc.
        label : str  # label that corresponds to the type of application
        confidence : float  # field that corresponds to confidence, ranges from 0.0 to 1.0
        reasons : List
        highlights : List
        explanation_html : str 
        suggested_actions : List 
        domain : str 
        identified_brand : str
        b64_screenshot : str 
        is_in_global_whitelist : bool
        is_in_personal_whitelist : bool 
        is_in_blacklist : bool 
        url : str
        

        
class CerberusAgent(Agent): 
    def __init__(self):
        self.whitelist = Whitelist()
        self.blacklist = Blacklist()
        self.personalWhitelist = PersonalWhitelist()
        self.graph = self.___construct_and_compile_graph__()

    def print_graph(self):
        png_bytes = self.graph.get_graph().draw_mermaid_png()

        # Output path (choose whatever path you like)
        output_path = Path("graph.png")

        # Write the bytes to a file
        with open(output_path, "wb") as f:
            f.write(png_bytes)


    def invoke(self, screenshot: str, url: str) -> dict:
        # derive domain from URL
        host = urlparse(url).hostname or ""
        try:
            host = idna.encode(host).decode("ascii")  # punycode-safe
        except Exception:
            pass

        state = CerberusState(
            messages=[],
            label=None,
            confidence=None,
            reasons=None,
            highlights=None,
            explanation_html=None,
            suggested_actions=None,
            domain=host,                      # <-- IMPORTANT
            identified_brand=None,
            b64_screenshot=screenshot,
            is_in_global_whitelist=None,
            is_in_personal_whitelist=None,
            is_in_blacklist=None,
            url=url,
        )
        return self.graph.invoke(state)

    def extract_info(self, text: str):
        """
        Parse:
        1. BrandMatch: <True/False>
        2. Explanation: <...>   (may span multiple lines)
        3. Confidence: <0.0-1.0> | <float> | <percent> | unknown

        Returns:
            {
                "BrandMatch": bool,
                "BrandMatchExplanation": str,
                "Confidence": Optional[float],   # normalized to [0,1] or None
            }
        Raises:
            ValueError if BrandMatch/Explanation cannot be parsed.
        """

        pattern = re.compile(
            r"""
            ^\s*1\.\s*BrandMatch\s*:\s*<?\s*(True|False)\s*>?\s*$
            (?P<between_1_2>.*?)
            ^\s*2\.\s*Explanation\s*:\s*(?P<expl>.*?)
            (?=^\s*3\.|\Z)
            ^\s*3\.\s*Confidence\s*:\s*<?\s*(?P<conf>
                (?:[01](?:\.\d+)?\s*-\s*[01](?:\.\d+)?)    # range: a-b
                |(?:[01](?:\.\d+)?)                        # single number
                |(?:\d{1,3}\s*%)                           # percentage
                |(?:unknown|n/?a)                          # unknown
            )\s*>?\s*$
            """,
            re.IGNORECASE | re.MULTILINE | re.DOTALL | re.VERBOSE,
        )

        m = pattern.search(text)
        if not m:
            raise ValueError(f"Could not parse BrandMatch/Explanation/Confidence from input:{text}")

        brand_match = m.group(1).strip().lower() == "true"
        explanation = m.group("expl").strip()

        raw_conf = m.group("conf").strip().lower()
        confidence: Optional[float] = None

        try:
            if raw_conf in {"unknown", "n/a", "na"}:
                confidence = None
            elif "%" in raw_conf:
                # e.g., "85%" -> 0.85
                num = float(raw_conf.replace("%", "").strip())
                confidence = max(0.0, min(1.0, num / 100.0))
            elif "-" in raw_conf:
                # range "a-b" -> midpoint
                a_str, b_str = [p.strip() for p in raw_conf.split("-", 1)]
                a, b = float(a_str), float(b_str)
                confidence = max(0.0, min(1.0, (a + b) / 2.0))
            else:
                # single number
                val = float(raw_conf)
                confidence = max(0.0, min(1.0, val))
        except Exception:
            confidence = None  # fall back safely

        return {
            "BrandMatch": brand_match,
            "BrandMatchExplanation": explanation,
            "Confidence": confidence,
        }

    def ___construct_and_compile_graph__(self) -> CompiledStateGraph:
        """Constructs the state graph necessary for the agent
        Returns: StateGraph
        """

        def check_whitelist(state : CerberusState):
            result = self.whitelist.check(state["url"])
            state["is_in_global_whitelist"] = result

            if state["is_in_global_whitelist"]:
                state['reasons'] = 'URL is in global whitelist'
                state['label'] = 'benign'
            return state 

        def check_whitelist_decider(state : CerberusState):
            # return "benign" or "phish"
            if state["is_in_global_whitelist"]:
                return "benign"
            else:
                return "phish"
        
        def check_blacklist(state : CerberusState): 
            result = self.blacklist.check(state["url"])
            state["is_in_blacklist"] = result

            if state["is_in_blacklist"]:
                state['reasons'] = 'URL is in blacklist'
                state['label'] = 'phishing'
            return state 

        def check_blacklist_decider(state : CerberusState):
            # return "benign" or "phish"
            if state["is_in_blacklist"]:
                return "phish"
            else:
                return "benign"
        
        
        def check_cache(state : CerberusState): 
            result = self.personalWhitelist.check(state["url"])
            state["is_in_personal_whitelist"] = result

            if state["is_in_personal_whitelist"]:
                state['reasons'] = 'URL is in personal whitelist'
                state['label'] = 'benign'
            return state 
        
        def check_cache_decider(state : CerberusState):
            # if cache proves benign → "benign"; else → "phish" to continue
            if state["is_in_personal_whitelist"]:
                return "benign"
            else:
                return "phish"
        
        def identify_brand(state, llm) -> str:
            screenshot = state["b64_screenshot"]

            system_message = SystemMessage(content=self.load_prompt("brand_identification_prompt"))

            human_message = HumanMessage(content=[
                {"type": "text", "text": "Identify the brand present in this screenshot."},
                {"type": "image_url", "image_url": f"data:image/png;base64,{screenshot}"},
            ])

            messages = [system_message, human_message]

            # 2) Invoke the model
            response = llm.invoke(messages)

            # 3) Safely extract text and normalize
            text = response.content if isinstance(response, AIMessage) else str(response)
            state["identified_brand"] = text.strip().lower()
            return state 
        
    

        def check_brand_match(state, llm) -> str:
            
            system_message = SystemMessage(content=self.load_prompt("domain_matching_prompt"))
            human_message = f"""
            Here is the identified brand name: {state["identified_brand"]}
            Here is the domain: {state["url"]}

            """
            human_message = HumanMessage(content=human_message)
            
            messages = [
                system_message,
                human_message
            ]
            response = llm.invoke(messages)
            response = response.content.lower().strip()
            response = self.extract_info(response)
            state["confidence"] = response["Confidence"]
            state["reasons"] = response["BrandMatchExplanation"]
            state["label"] = "benign" if response.get("BrandMatch") else "phishing"
            return state 

        def identify_brand_client_side(state : CerberusState) -> CerberusState:
            # Original: ChatOllama(model="gemma3:4b")
            # Using llama3.2 which is already installed with temperature=0 for deterministic results
            return identify_brand(state, ChatOllama(model="gemma3:4b", temperature=0))

        def identify_brand_server_side(state : CerberusState) -> CerberusState:
            # Original: ChatGoogleGenerativeAI(model="gemini-2.5-flash")
            # Using gemini-2.0-flash-exp which is available with temperature=0 for deterministic results
            return identify_brand(state, ChatGoogleGenerativeAI(model="gemini-2.0-flash-exp", temperature=0))

        def check_domain_client_side(state : CerberusState) -> CerberusState:
            # Original: ChatOllama(model="gemma3:270m")
            # Using llama3.2 which is already installed with temperature=0 for deterministic results
            return check_brand_match(state, ChatOllama(model="gemma3:4b", temperature=0))

        def check_domain_server_side(state : CerberusState) -> CerberusState:
            # Original: ChatGoogleGenerativeAI(model="gemini-2.5-flash")
            # Using gemini-2.0-flash-exp which is available with temperature=0 for deterministic results
            return check_brand_match(state, ChatGoogleGenerativeAI(model="gemini-2.0-flash-exp", temperature=0))
        
        def race_identify_check_and_logo(state: CerberusState) -> CerberusState:
            # Run async code in a separate thread to avoid event loop conflicts
            def run_in_new_loop():
                # Create a new event loop for this thread
                new_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(new_loop)
                try:
                    return new_loop.run_until_complete(race_identify_check_and_logo_async(state))
                finally:
                    new_loop.close()

            # Execute in a thread pool
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(run_in_new_loop)
                return future.result()
            
        async def race_identify_check_and_logo_async(state: CerberusState) -> CerberusState:
            s_client = copy.deepcopy(state)
            s_server = copy.deepcopy(state)

            # Wrap synchronous functions to run in thread pool
            async def client_pipeline():
                loop = asyncio.get_event_loop()
                # Run synchronous code in thread pool
                sc = await loop.run_in_executor(None, identify_brand_client_side, s_client)
                sc = await loop.run_in_executor(None, check_domain_client_side, sc)
                return "client", sc

            async def server_pipeline():
                loop = asyncio.get_event_loop()
                # Run synchronous code in thread pool
                ss = await loop.run_in_executor(None, identify_brand_server_side, s_server)
                ss = await loop.run_in_executor(None, check_domain_server_side, ss)
                return "server", ss

            client_task = asyncio.create_task(client_pipeline())
            server_task = asyncio.create_task(server_pipeline())


            done, pending = await asyncio.wait(
                {client_task, server_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            winner_task = next(iter(done))
            side, side_state = await winner_task  # side: "client" | "server"

            for t in pending:
                t.cancel()

            return side_state

        graph = StateGraph(CerberusState)

        # core nodes
        graph.add_node("check_whitelist", check_whitelist)
        graph.add_node("check_blacklist", check_blacklist)
        graph.add_node("check_cache", check_cache)

        # parallel race + logo
        graph.add_node("race_identify_check_and_logo", race_identify_check_and_logo)


        # edges
        graph.add_edge(START, "check_whitelist")
        
        graph.add_conditional_edges(
            "check_whitelist",
            check_whitelist_decider,
            {
                "benign" : END,
                "phish" : "check_blacklist"
            }
        )
        
        graph.add_conditional_edges(
            "check_blacklist",
            check_blacklist_decider,
            {
                "benign" : "check_cache",
                "phish" : END
            }
        )

        graph.add_conditional_edges(
            "check_cache",
            check_cache_decider,
            {
                "benign" : END,
                "phish" : "race_identify_check_and_logo"
            }
        )

        graph.add_edge("race_identify_check_and_logo", END)



        return graph.compile()