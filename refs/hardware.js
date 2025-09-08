// Hardware page functionality
function loadHardwarePage(container) {
    container.innerHTML = `
        <div class="hardware-container">
            <div class="tab-navigation">
                <button class="tab-button active" data-tab="buttons">Buttons & Scroll</button>
                <button class="tab-button" data-tab="accelerometer">Accelerometer</button>
            </div>
            
            <div class="tab-content active" id="buttons-tab">
                <div class="button-section">
                    <h3>Hardware Buttons</h3>
                    <div class="button-row">
                        <button class="hw-button" id="upBtn">Scroll UP</button>
                        <div class="led-indicator" id="upLed"></div>
                    </div>
                    <div class="button-row">
                        <button class="hw-button" id="downBtn">Scroll DOWN</button>
                        <div class="led-indicator" id="downLed"></div>
                    </div>
                    <div class="button-row">
                        <button class="hw-button" id="pttBtn">PTT (Side Button)</button>
                        <div class="led-indicator" id="pttLed"></div>
                    </div>
                    <div class="button-info">
                        <p>Test the scroll wheel and PTT button. LEDs will blink when events are detected.</p>
                    </div>
                </div>
            </div>
            
            <div class="tab-content" id="accelerometer-tab">
                <div class="accelerometer-widget">
                    <h3>Accelerometer Data</h3>
                    <div class="accel-controls">
                        <button id="toggleAccel">Start Accelerometer</button>
                        <div class="frequency-info">
                            <label>Frequency: </label>
                            <select id="accelFreq">
                                <option value="10">10 Hz</option>
                                <option value="30">30 Hz</option>
                                <option value="60" selected>60 Hz (Default)</option>
                                <option value="100">100 Hz</option>
                            </select>
                        </div>
                    </div>
                    <div class="accel-section">
                        <h4>Tilt Values (Normalized -1 to 1)</h4>
                        <div class="accel-values">
                            <div class="accel-axis">
                                <div class="accel-label">Tilt X</div>
                                <div class="accel-value" id="tiltX">0.00</div>
                            </div>
                            <div class="accel-axis">
                                <div class="accel-label">Tilt Y</div>
                                <div class="accel-value" id="tiltY">0.00</div>
                            </div>
                            <div class="accel-axis">
                                <div class="accel-label">Tilt Z</div>
                                <div class="accel-value" id="tiltZ">0.00</div>
                            </div>
                        </div>
                    </div>
                    <div class="accel-section">
                        <h4>Raw Values (m/s²)</h4>
                        <div class="accel-values">
                            <div class="accel-axis">
                                <div class="accel-label">Raw X</div>
                                <div class="accel-value" id="rawX">0.00</div>
                            </div>
                            <div class="accel-axis">
                                <div class="accel-label">Raw Y</div>
                                <div class="accel-value" id="rawY">0.00</div>
                            </div>
                            <div class="accel-axis">
                                <div class="accel-label">Raw Z</div>
                                <div class="accel-value" id="rawZ">0.00</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize hardware module
    const hardwareModule = {
        isAccelRunning: false,
        
        handleScrollUp: function() {
            this.blinkLED('upLed');
            console.log('Scroll up detected');
        },
        
        handleScrollDown: function() {
            this.blinkLED('downLed');
            console.log('Scroll down detected');
        },
        
        handlePTT: function() {
            this.blinkLED('pttLed');
            console.log('PTT button pressed');
        },
        
        blinkLED: function(ledId) {
            const led = document.getElementById(ledId);
            if (led) {
                led.classList.add('blink');
                setTimeout(() => {
                    led.classList.remove('blink');
                }, 500);
            }
        },
        
        toggleAccelerometer: function() {
            const btn = document.getElementById('toggleAccel');
            
            // Check if API exists
            if (typeof window.creationSensors === 'undefined') {
                console.log('creationSensors not defined');
                btn.textContent = 'API Not Available';
                return;
            }
            
            if (!window.creationSensors.accelerometer) {
                console.log('accelerometer not in creationSensors');
                btn.textContent = 'Accel Not Available';
                return;
            }
            
            if (!this.isAccelRunning) {
                console.log('Starting accelerometer...');
                
                // Check availability first
                const self = this;
                if (window.creationSensors.accelerometer.isAvailable) {
                    window.creationSensors.accelerometer.isAvailable().then(available => {
                        if (!available) {
                            console.log('Accelerometer not available on device');
                            btn.textContent = 'Not Available';
                            return;
                        }
                        
                        // Start accelerometer with selected frequency
                        const frequency = parseInt(document.getElementById('accelFreq').value) || 60;
                        try {
                            window.creationSensors.accelerometer.start((data) => {
                                console.log('Accel data:', data);
                                if (data) {
                                    // Update tilt values
                                    if (document.getElementById('tiltX') && data.tiltX !== undefined) {
                                        document.getElementById('tiltX').textContent = data.tiltX.toFixed(2);
                                        document.getElementById('tiltY').textContent = data.tiltY !== undefined ? data.tiltY.toFixed(2) : '0.00';
                                        document.getElementById('tiltZ').textContent = data.tiltZ !== undefined ? data.tiltZ.toFixed(2) : '0.00';
                                    }
                                    // Update raw values
                                    if (document.getElementById('rawX') && data.rawX !== undefined) {
                                        document.getElementById('rawX').textContent = data.rawX.toFixed(2);
                                        document.getElementById('rawY').textContent = data.rawY !== undefined ? data.rawY.toFixed(2) : '0.00';
                                        document.getElementById('rawZ').textContent = data.rawZ !== undefined ? data.rawZ.toFixed(2) : '0.00';
                                    }
                                }
                            }, { frequency: frequency });
                            
                            self.isAccelRunning = true;
                            btn.textContent = 'Stop Accelerometer';
                            console.log('Accelerometer started');
                        } catch (e) {
                            console.error('Error starting accelerometer:', e);
                            btn.textContent = 'Start Failed';
                        }
                    }).catch(err => {
                        console.error('Error checking availability:', err);
                        btn.textContent = 'Check Failed';
                    });
                } else {
                    // Try starting without availability check
                    const frequency = parseInt(document.getElementById('accelFreq').value) || 60;
                    try {
                        window.creationSensors.accelerometer.start((data) => {
                            console.log('Accel data:', data);
                            if (data) {
                                // Update tilt values
                                if (document.getElementById('tiltX') && data.tiltX !== undefined) {
                                    document.getElementById('tiltX').textContent = data.tiltX.toFixed(2);
                                    document.getElementById('tiltY').textContent = data.tiltY !== undefined ? data.tiltY.toFixed(2) : '0.00';
                                    document.getElementById('tiltZ').textContent = data.tiltZ !== undefined ? data.tiltZ.toFixed(2) : '0.00';
                                }
                                // Update raw values
                                if (document.getElementById('rawX') && data.rawX !== undefined) {
                                    document.getElementById('rawX').textContent = data.rawX.toFixed(2);
                                    document.getElementById('rawY').textContent = data.rawY !== undefined ? data.rawY.toFixed(2) : '0.00';
                                    document.getElementById('rawZ').textContent = data.rawZ !== undefined ? data.rawZ.toFixed(2) : '0.00';
                                }
                            }
                        }, { frequency: 60 });
                        
                        this.isAccelRunning = true;
                        btn.textContent = 'Stop Accelerometer';
                        console.log('Accelerometer started (no availability check)');
                    } catch (e) {
                        console.error('Error starting accelerometer:', e);
                        btn.textContent = 'Start Failed';
                    }
                }
            } else {
                console.log('Stopping accelerometer...');
                try {
                    window.creationSensors.accelerometer.stop();
                    this.isAccelRunning = false;
                    btn.textContent = 'Start Accelerometer';
                    
                    // Reset all values
                    document.getElementById('tiltX').textContent = '0.00';
                    document.getElementById('tiltY').textContent = '0.00';
                    document.getElementById('tiltZ').textContent = '0.00';
                    document.getElementById('rawX').textContent = '0.00';
                    document.getElementById('rawY').textContent = '0.00';
                    document.getElementById('rawZ').textContent = '0.00';
                    console.log('Accelerometer stopped');
                } catch (e) {
                    console.error('Error stopping accelerometer:', e);
                    btn.textContent = 'Stop Failed';
                }
            }
        }
    };
    
    // Store module reference
    pageModules.hardware = hardwareModule;
    
    // Set up tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
    
    // Set up accelerometer toggle button
    document.getElementById('toggleAccel').addEventListener('click', () => {
        hardwareModule.toggleAccelerometer();
    });
    
    // Manual button clicks for testing
    document.getElementById('upBtn').addEventListener('click', () => {
        hardwareModule.handleScrollUp();
    });
    
    document.getElementById('downBtn').addEventListener('click', () => {
        hardwareModule.handleScrollDown();
    });
    
    document.getElementById('pttBtn').addEventListener('click', () => {
        hardwareModule.handlePTT();
    });
}