#!/bin/bash
yes | apt update
yes | apt upgrade -y
yes | apt install -y nodejs git
yes | npm i
npm start
