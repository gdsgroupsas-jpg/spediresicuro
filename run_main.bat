@echo off
setlocal
set "PYTHONUTF8=1"
py -m pip install -r requirements.txt
py main.py
