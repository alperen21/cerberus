from abc import ABC, abstractmethod
from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import StateGraph, END, START
from typing import TypedDict, Annotated, Sequence, List
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, ToolMessage, AIMessage, SystemMessage, HumanMessage
from langgraph.graph.state import CompiledStateGraph
from pathlib import Path
import re
from langgraph.prebuilt import ToolNode
from rich.console import Console
from rich.text import Text

class Agent(ABC):
    """Abstract base class for all agents."""
    

    @abstractmethod
    def ___construct_and_compile_graph__(self) -> CompiledStateGraph:
        pass 
    
    def show_graph_diagram(self, compiled_graph : CompiledStateGraph) -> None:
        """
        Print agent graph using ASCII

        Args:
            compiled_graph (CompiledStateGraph): compiled graph, ___construct_and_compile_graph__ should return CompiledStateGraph
        """
        print(compiled_graph.get_graph().draw_ascii())
        
    def load_prompt(self, prompt_name: str) -> str:
        """
        Load a prompt from the prompts directory.
        
        Args:
            prompt_type (str): The type of prompt (e.g., 'react')
            prompt_name (str): The name of the prompt file (e.g., 'react_system_prompt.txt')
        
        Returns:
            str: The content of the prompt file
        
        Raises:
            FileNotFoundError: If the prompt file cannot be found
        """
        # Get the project root directory (two levels up from agentic/agents.py)
        project_root = Path(__file__).parent
        prompt_path = project_root / "prompts" / f"{prompt_name}.txt"
        
        # Read the prompt from file
        with open(prompt_path, 'r') as f:
            return f.read().strip()
    
    
    def __print_stream(self, stream):
        # State for the current contiguous tail of ToolMessages
        tool_tail_printed = 0  # how many tool messages from the current tail we've printed
        console = Console()


        for s in stream:
            messages = s["messages"]
            if not messages:
                continue

            last = messages[-1]
            content = getattr(last, "content", "")

            # 1) Detect the length of the trailing run of ToolMessage objects.
            tail_len = 0
            i = len(messages) - 1
            while i >= 0 and isinstance(messages[i], ToolMessage):
                tail_len += 1
                i -= 1

            # 2) If there is a tool tail and it directly follows an AIMessage, print only the *new* tool outputs.
            if tail_len > 0 and i >= 0 and isinstance(messages[i], AIMessage):
                start = len(messages) - tail_len + tool_tail_printed
                # print any new tool messages in the tail
                for j in range(start, len(messages)):
                    tm = messages[j]
                    tm_content = getattr(tm, "content", "")
                    console.print(Text(f"====Tool Output====\n{tm_content}", style="#FF00FF"))
                # update how many of the current tail we have printed
                tool_tail_printed = tail_len
                continue
            else:
                # Not in a valid tool tail run; reset the counter.
                tool_tail_printed = 0

            # 3) Handle normal (non-tool-tail) cases.
            if isinstance(last, HumanMessage):
                console.print(Text(f"====Human Message====\n{content}", style="#00FFFF"))

            elif isinstance(last, AIMessage) and hasattr(last, "tool_calls") and last.tool_calls:
                for tc in last.tool_calls:
                    console.print(Text(
                        f"====Tool Call====\nTool Name: {tc.get('name')}\nTool Args: {tc.get('args')}",
                        style="purple"
                    ))

            elif isinstance(last, AIMessage):
                console.print(Text(f"====AI Message====\n{content}", style="#00FF00"))

            elif isinstance(last, SystemMessage):
                console.print(Text(f"====System Message====\n{content}", style="bright_green"))

            elif isinstance(last, ToolMessage):
                # Single, isolated ToolMessage not following an AI tail -> do not print (per your rule)
                pass

            else:
                console.print(Text(str(last), style="white"))
        return s

