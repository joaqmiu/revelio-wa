#!/bin/bash
yes | apt update
yes | apt upgrade -y
yes | apt install -y nodejs git
git clone https://github.com/joaqmiu/revelio-wa/
cd revelio-wa
npm i
npm start
