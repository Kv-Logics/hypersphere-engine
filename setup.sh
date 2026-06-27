#!/bin/bash

# Setup script for Hypersphere Face Attendance Engine
# Exit immediately if a command exits with a non-zero status
set -e

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;7m' # No Color
CLEAR='\033[0m'

echo -e "${BLUE}======================================================${CLEAR}"
echo -e "${BLUE}       HYPERSPHERE ENGINE ENVIRONMENT SETUP           ${CLEAR}"
echo -e "${BLUE}======================================================${CLEAR}"

# 1. System Requirements Warning
echo -e "\n${YELLOW}[STEP 1] Checking System Requirements${CLEAR}"
echo -e "Make sure you have run the following commands to install Linux system dependencies:"
echo -e "${GREEN}  sudo apt update${CLEAR}"
echo -e "${GREEN}  sudo apt install -y python3-pip python3-venv libgl1 libglib2.0-0${CLEAR}"
echo -e "Press [ENTER] if you have already installed these, or press [Ctrl+C] to exit and install them first."
read -p ""

# 2. Virtual Environment Creation
echo -e "\n${YELLOW}[STEP 2] Creating Python Virtual Environment...${CLEAR}"
if [ -f "backend/venv/bin/activate" ]; then
    echo -e "Virtual environment 'backend/venv' already exists and is valid. Skipping creation."
else
    echo -e "Creating new virtual environment (cleaning up any broken environment)..."
    rm -rf backend/venv
    python3 -m venv backend/venv
    echo -e "${GREEN}Virtual environment created successfully!${CLEAR}"
fi

# 3. Installing Python Dependencies
echo -e "\n${YELLOW}[STEP 3] Activating environment & installing python packages...${CLEAR}"
source backend/venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# 4. Check for Model Weight Files
echo -e "\n${YELLOW}[STEP 4] Verifying model weights...${CLEAR}"
MISSING_MODELS=0

if [ -f "w600k_r50.onnx" ]; then
    echo -e "${GREEN}✓ Found w600k_r50.onnx (Face Recognition model)${CLEAR}"
else
    echo -e "${RED}✗ Missing w600k_r50.onnx (Face Recognition model)${CLEAR}"
    echo -e "  Please download the model and place it in the root folder: ${YELLOW}$(pwd)/w600k_r50.onnx${CLEAR}"
    MISSING_MODELS=1
fi

if [ -f "2.7_80x80_MiniFASNetV2.pth" ]; then
    echo -e "${GREEN}✓ Found 2.7_80x80_MiniFASNetV2.pth (Anti-Spoofing model)${CLEAR}"
else
    echo -e "${RED}✗ Missing 2.7_80x80_MiniFASNetV2.pth (Anti-Spoofing model)${CLEAR}"
    echo -e "  Please download the model and place it in the root folder: ${YELLOW}$(pwd)/2.7_80x80_MiniFASNetV2.pth${CLEAR}"
    MISSING_MODELS=1
fi

if [ $MISSING_MODELS -eq 1 ]; then
    echo -e "\n${YELLOW}[NOTE] The backend API will start in MOCK mode because model weights are missing.${CLEAR}"
    echo -e "Once you download and place the weights in the root directory, restart the server to load actual models."
else
    echo -e "${GREEN}✓ All models loaded successfully! Backend will boot in FULL PRODUCTION mode.${CLEAR}"
fi

# 5. Done
echo -e "\n${GREEN}======================================================${CLEAR}"
echo -e "${GREEN}               SETUP COMPLETED SUCCESSFULLY!          ${CLEAR}"
echo -e "${GREEN}======================================================${CLEAR}"
echo -e "To start the FastAPI backend server, run:"
echo -e "  ${BLUE}cd backend && source venv/bin/activate && ./run.sh${CLEAR}\n"
