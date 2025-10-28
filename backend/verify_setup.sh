#!/bin/bash

# Cerberus Setup Verification Script
# This script checks if your environment is properly configured

echo "🔍 Cerberus Setup Verification"
echo "=============================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Check 1: Python version
echo "1. Checking Python version..."
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
if [[ $(python3 -c "import sys; print(int(sys.version_info >= (3, 9)))") == "1" ]]; then
    echo -e "   ${GREEN}✅${NC} Python $PYTHON_VERSION"
else
    echo -e "   ${RED}❌${NC} Python $PYTHON_VERSION (requires 3.9+)"
    ERRORS=$((ERRORS + 1))
fi

# Check 2: Virtual environment
echo "2. Checking virtual environment..."
if [ -d "venv" ]; then
    echo -e "   ${GREEN}✅${NC} Virtual environment exists"
else
    echo -e "   ${YELLOW}⚠️${NC}  No virtual environment found (recommended)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 3: Required packages
echo "3. Checking required packages..."
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

REQUIRED_PACKAGES=("fastapi" "uvicorn" "langchain" "langchain_google_genai" "google.cloud.bigquery")
for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if python3 -c "import $pkg" 2>/dev/null; then
        echo -e "   ${GREEN}✅${NC} $pkg installed"
    else
        echo -e "   ${RED}❌${NC} $pkg not installed"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check 4: GOOGLE_API_KEY
echo "4. Checking GOOGLE_API_KEY..."
if [ -z "$GOOGLE_API_KEY" ]; then
    echo -e "   ${RED}❌${NC} GOOGLE_API_KEY not set"
    echo "      Get one from: https://makersuite.google.com/app/apikey"
    echo "      Set with: export GOOGLE_API_KEY=your-api-key-here"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}✅${NC} GOOGLE_API_KEY is set (${GOOGLE_API_KEY:0:10}...)"
fi

# Check 5: GOOGLE_APPLICATION_CREDENTIALS
echo "5. Checking GOOGLE_APPLICATION_CREDENTIALS..."
if [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo -e "   ${YELLOW}⚠️${NC}  GOOGLE_APPLICATION_CREDENTIALS not set"
    echo "      Whitelist feature may not work"
    echo "      See: docs/GOOGLE_CLOUD_SETUP.md"
    WARNINGS=$((WARNINGS + 1))
else
    if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        echo -e "   ${GREEN}✅${NC} GOOGLE_APPLICATION_CREDENTIALS is set and file exists"
        echo "      Path: $GOOGLE_APPLICATION_CREDENTIALS"
    else
        echo -e "   ${RED}❌${NC} GOOGLE_APPLICATION_CREDENTIALS is set but file not found"
        echo "      Path: $GOOGLE_APPLICATION_CREDENTIALS"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Check 6: Server files
echo "6. Checking server files..."
REQUIRED_FILES=("server.py" "agentic/agent.py" "filter/whitelist.py" "filter/blacklist.py")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "   ${GREEN}✅${NC} $file exists"
    else
        echo -e "   ${RED}❌${NC} $file not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check 7: Test imports
echo "7. Testing Python imports..."
if python3 -c "from agentic.agent import CerberusAgent; from filter.whitelist import Whitelist" 2>/dev/null; then
    echo -e "   ${GREEN}✅${NC} All Python modules can be imported"
else
    echo -e "   ${RED}❌${NC} Import error - check dependencies"
    ERRORS=$((ERRORS + 1))
fi

# Check 8: Port availability
echo "8. Checking if port 8000 is available..."
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "   ${YELLOW}⚠️${NC}  Port 8000 is already in use"
    echo "      Stop existing server or use a different port"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "   ${GREEN}✅${NC} Port 8000 is available"
fi

# Summary
echo ""
echo "=============================="
echo "Summary:"
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All checks passed!${NC}"
        echo ""
        echo "You can start the server with:"
        echo "  ./start_server.sh"
    else
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
        echo ""
        echo "The server should work, but some features may be limited."
        echo "Check the warnings above for details."
    fi
else
    echo -e "${RED}❌ $ERRORS error(s) found${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
    fi
    echo ""
    echo "Please fix the errors above before starting the server."
    echo ""
    echo "For help, see:"
    echo "  - backend/API_KEYS.md"
    echo "  - docs/QUICKSTART.md"
    echo "  - docs/COMPLETE_SETUP.md"
    exit 1
fi

echo ""
echo "For more information, see backend/API_KEYS.md"
