# Web browser based heart rate monitor
- Uses the camera of your phone or your computer to detect your heart rate. This is not a professional medical tool. Use at your own risk.
- Analyzes the brightness changes with FFT to detect heart beats per minute.
- In addition to being functional, also looks cool in my opinion.

## Screenshot
- Should look like this when it loads on your phone (or any other device with camera)
![Screenshot image](screenshot.png?raw=true "Screenshot image")

## Privacy
- This product is 100% private, all the source code used you can see right here. 
- No data is collected or sent anywhere. 
- No ads are pushed in your face
- All source is available on github
- Enjoy.

## Features
- Real-time heart rate monitoring using camera
- Visual display of heart rate in BPM
- Pulse graph visualization
- Torch/flashlight control
- Privacy-focused - no data collection, no ads, no tracking, no nothing

## Files
- `index.html` - Main HTML structure
- `style.css` - Styling for the application
- `script.js` - Core application logic
- `tests.js` - Testing library and tests

## How to Use
- Easy path: open the page from github at https://kulminaator.github.io/web-heart-rate-monitor/ 
- Hard path: clone repo, open index.html
- When opening the app - cover the camera with your finger, press "start"
- Wait for the signal to stabilize and look at the reading

## Requirements
- Modern browser with WebRTC support
- Camera access permissions


## Development requirements
- fairly recent nodejs and npm
- tests are run with npm test


## Coding standards and flow
- We always start out with planning and making a todo list of tasks
- We verify after every edit that we did not make any typos or logic mistakes
- We create tests for every new functionality added, if possible
- Tests are run with npm and nodejs and not in a browser
- We run tests and repair any defects
