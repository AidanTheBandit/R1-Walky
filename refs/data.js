// Data page functionality
function loadDataPage(container) {
    container.innerHTML = `
        <div class="data-container">
            <div class="data-buttons">
                <button class="data-button" id="catFactsBtn">Cat Facts</button>
                <button class="data-button" id="dinosBtn">Dinos</button>
                <button class="data-button toggle" id="paintBtn">Paint it black</button>
            </div>
            <div class="chat-window" id="dataChat"></div>
            <button id="clearChat" style="margin-top: 6px; padding: 4px 8px; font-size: 10px;">Clear</button>
        </div>
    `;
    
    // Initialize data module
    const dataModule = {
        paintState: 'black',
        
        sendCatFacts: function() {
            const message = 'Tell me 5 facts about cats. Respond ONLY with valid JSON in this exact format: {"facts":["fact1","fact2","fact3","fact4","fact5"]}';
            this.sendLLMMessage(message);
            this.addToChat('Requesting cat facts...', 'system');
        },
        
        sendDinoFact: function() {
            const message = "tell me a fact about dinosaurs";
            this.sendLLMMessage(message);
            this.addToChat('Requesting dinosaur fact...', 'system');
        },
        
        togglePaint: function() {
            const btn = document.getElementById('paintBtn');
            this.paintState = this.paintState === 'black' ? 'red' : 'black';
            btn.textContent = `Paint it ${this.paintState}`;
            btn.classList.toggle('red', this.paintState === 'red');
            
            const message = `Give me the hex color code for ${this.paintState}. Return ONLY valid JSON in this exact format: {"paint":"#hexcode"}`;
            this.sendLLMMessage(message);
            this.addToChat(`Requesting ${this.paintState} paint...`, 'system');
        },
        
        sendLLMMessage: function(message) {
            if (typeof PluginMessageHandler !== 'undefined') {
                const payload = {
                    message: message,
                    useLLM: true
                };
                PluginMessageHandler.postMessage(JSON.stringify(payload));
            } else {
                console.log('PluginMessageHandler not available, message:', message);
                this.addToChat('Plugin API not available', 'error');
            }
        },
        
        handleMessage: function(data) {
            console.log('Data page handling message:', data);
            
            // First try to parse data.data field
            if (data.data) {
                console.log('Trying to parse data.data:', data.data);
                try {
                    // Handle if data.data is already an object
                    const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                    console.log('Parsed data:', parsed);
                    
                    // Handle cat facts
                    if (parsed.facts && Array.isArray(parsed.facts)) {
                        console.log('Found facts array:', parsed.facts);
                        parsed.facts.forEach((fact, index) => {
                            this.addToChat(`Fact ${index + 1}: ${fact}`, 'fact');
                        });
                        return; // Exit after handling facts
                    }
                    
                    // Handle paint color
                    if (parsed.paint) {
                        console.log('Found paint color:', parsed.paint);
                        updateAppBorderColor(parsed.paint);
                        this.addToChat(`Border painted: ${parsed.paint}`, 'system');
                        return; // Exit after handling paint
                    }
                    
                    // If we have parsed data but no recognized fields
                    this.addToChat(`Data: ${JSON.stringify(parsed)}`, 'msg');
                } catch (e) {
                    console.error('Error parsing data.data:', e);
                    // data.data wasn't valid JSON, treat as plain text
                    this.addToChat(`Response: ${data.data}`, 'msg');
                }
            }
            
            // Also check if message field contains JSON
            if (data.message) {
                console.log('Checking message field:', data.message);
                
                // Try to parse message as JSON first
                try {
                    const parsed = JSON.parse(data.message);
                    console.log('Parsed message as JSON:', parsed);
                    
                    if (parsed.facts && Array.isArray(parsed.facts)) {
                        parsed.facts.forEach((fact, index) => {
                            this.addToChat(`Fact ${index + 1}: ${fact}`, 'fact');
                        });
                        return;
                    }
                    
                    if (parsed.paint) {
                        updateAppBorderColor(parsed.paint);
                        this.addToChat(`Border painted: ${parsed.paint}`, 'system');
                        return;
                    }
                } catch (e) {
                    // Not JSON, display as regular message
                    this.addToChat(`msg: ${data.message}`, 'msg');
                }
            }
        },
        
        addToChat: function(text, type = 'msg') {
            const chat = document.getElementById('dataChat');
            if (!chat) return;
            
            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-message ${type}`;
            msgDiv.textContent = text;
            
            chat.appendChild(msgDiv);
            chat.scrollTop = chat.scrollHeight;
        },
        
        clearChat: function() {
            const chat = document.getElementById('dataChat');
            if (chat) {
                chat.innerHTML = '';
            }
        }
    };
    
    // Store module reference
    pageModules.data = dataModule;
    
    // Set up button event listeners
    document.getElementById('catFactsBtn').addEventListener('click', () => {
        dataModule.sendCatFacts();
    });
    
    document.getElementById('dinosBtn').addEventListener('click', () => {
        dataModule.sendDinoFact();
    });
    
    document.getElementById('paintBtn').addEventListener('click', () => {
        dataModule.togglePaint();
    });
    
    document.getElementById('clearChat').addEventListener('click', () => {
        dataModule.clearChat();
    });
}