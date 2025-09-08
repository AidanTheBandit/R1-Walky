// Speak page functionality
function loadSpeakPage(container) {
    container.innerHTML = `
        <div class="speak-container">
            <textarea id="speakText" class="speak-input" placeholder="Enter text to speak...">Hello, I am your R1 assistant.</textarea>
            <div class="speak-controls">
                <div class="speak-toggle">
                    <input type="checkbox" id="saveToJournal">
                    <label for="saveToJournal">Save to Journal</label>
                </div>
                <button id="speakBtn">Speak on R1</button>
                <button id="speakSilentBtn">Send Silently</button>
            </div>
            <div class="speak-status" id="speakStatus">Ready</div>
        </div>
    `;
    
    // Initialize speak module
    const speakModule = {
        speak: function(useR1Response) {
            const text = document.getElementById('speakText').value.trim();
            const saveToJournal = document.getElementById('saveToJournal').checked;
            
            if (!text) {
                alert('Please enter text to speak');
                return;
            }
            
            if (typeof PluginMessageHandler !== 'undefined') {
                const payload = {
                    message: text,
                    useLLM: true,
                    wantsR1Response: useR1Response,
                    wantsJournalEntry: saveToJournal
                };
                
                PluginMessageHandler.postMessage(JSON.stringify(payload));
                this.updateStatus(useR1Response ? 'Speaking...' : 'Processing...');
                
                // Reset status after a delay
                setTimeout(() => {
                    this.updateStatus('Ready');
                }, 3000);
            } else {
                this.updateStatus('Plugin API not available');
            }
        },
        
        handleMessage: function(data) {
            console.log('Speak page handling message:', data);
            
            if (data.message) {
                this.updateStatus(`Response: ${data.message.substring(0, 50)}...`);
            }
            
            if (data.data) {
                this.updateStatus('Response received');
            }
        },
        
        updateStatus: function(status) {
            const statusDiv = document.getElementById('speakStatus');
            if (statusDiv) {
                statusDiv.textContent = status;
            }
        }
    };
    
    // Store module reference
    pageModules.speak = speakModule;
    
    // Set up event listeners
    document.getElementById('speakBtn').addEventListener('click', () => {
        speakModule.speak(true);
    });
    
    document.getElementById('speakSilentBtn').addEventListener('click', () => {
        speakModule.speak(false);
    });
}