// Configuration
const API_BASE_URL = 'http://localhost:8000';

// DOM Elements
const welcomeScreen = document.getElementById('welcomeScreen');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const newChatBtn = document.getElementById('newChatBtn');
const exampleCards = document.querySelectorAll('.example-card');
const serviceSelect = document.getElementById('serviceSelect');

// Generation settings
const geminiSettings = document.getElementById('geminiSettings');
const modelSelectGroup = document.getElementById('modelSelectGroup');
const modelSelect = document.getElementById('modelSelect');
const aspectRatioSelect = document.getElementById('aspectRatio');
const imageSizeSelect = document.getElementById('imageSize');

// State
let currentImage = null;
let currentImageDataUrl = null;
let chatHistory = [];
let currentService = serviceSelect ? serviceSelect.value : 'gemini-image';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    autoResizeTextarea();
    checkAPIStatus();
});

// Event Listeners
function setupEventListeners() {
    // Send message
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Input validation
    messageInput.addEventListener('input', () => {
        autoResizeTextarea();
        validateInput();
    });

    // Image upload
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', removeImage);

    // New chat
    newChatBtn.addEventListener('click', startNewChat);

    // Example prompts
    exampleCards.forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.getAttribute('data-prompt');
            messageInput.value = prompt;
            validateInput();
            messageInput.focus();
        });
    });

    if (serviceSelect) {
        serviceSelect.addEventListener('change', handleServiceChange);
        handleServiceChange();
    }
}

// Auto-resize textarea
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
}

function handleServiceChange() {
    currentService = serviceSelect.value;
    if (geminiSettings) {
        // Hide image generation settings if in chat mode
        geminiSettings.style.display = currentService === 'chat' ? 'none' : 'block';
    }
    if (modelSelectGroup) {
        modelSelectGroup.style.display = currentService === 'gemini-image' ? 'block' : 'none';
    }
}

// Validate input
function validateInput() {
    const hasText = messageInput.value.trim().length > 0;
    const hasImage = currentImage !== null;
    sendBtn.disabled = !hasText && !hasImage;
}

// Handle image upload
async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showError('请上传图片文件');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showError('图片大小不能超过 10MB');
        return;
    }

    // Preview image
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        imagePreview.style.display = 'block';
        currentImage = file;
        currentImageDataUrl = e.target.result;
        validateInput();
    };
    reader.readAsDataURL(file);
}

// Remove image
function removeImage() {
    currentImage = null;
    currentImageDataUrl = null;
    fileInput.value = '';
    imagePreview.style.display = 'none';
    previewImg.src = '';
    validateInput();
}

// Send message
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !currentImage) return;

    // Hide welcome screen
    if (welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
        messagesContainer.classList.add('active');
    }

    const referenceImage = currentImageDataUrl;
    const userImagePreview = currentImage ? URL.createObjectURL(currentImage) : null;

    // Add user message
    addMessage('user', text, userImagePreview);

    // Clear input
    const userPrompt = text;
    messageInput.value = '';
    autoResizeTextarea();
    removeImage();
    validateInput();

    // Show loading
    const loadingId = addLoadingMessage();

    try {
        let response;
        let data;

        if (currentService === 'chat') {
            // Chat Mode
            const messages = [];

            // Build history from chatHistory
            // Note: This is a simple implementation. For production, you might want to limit history size.
            // We need to map our internal chatHistory format to OpenAI format
            chatHistory.forEach(msg => {
                // Skip the message we just added (it's already in UI but not processed yet? No, we just pushed it... wait)
                // addMessage pushes to chatHistory at the end.
                // But we haven't pushed the current message to chatHistory yet?
                // addMessage function pushes to chatHistory at line 302.
                // So the current message IS in chatHistory.

                // We should filter out the current message to avoid duplication if we are building it manually?
                // Actually, let's just build the messages array from chatHistory, 
                // BUT the last item in chatHistory is the one we just added (user message).
                // We need to format it correctly.

                const role = msg.sender === 'user' ? 'user' : 'assistant';
                let content = msg.text;

                // If it's the user message and has an image, we need to format it as multimodal
                if (role === 'user' && msg.imageUrl && msg.imageUrl.startsWith('data:')) {
                    content = [
                        { type: "text", text: msg.text || " " },
                        { type: "image_url", image_url: { url: msg.imageUrl } }
                    ];
                }

                messages.push({ role, content });
            });

            const requestBody = {
                messages: messages
            };

            response = await fetch(`${API_BASE_URL}/api/text_chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            data = await response.json();

            removeLoadingMessage(loadingId);

            if (data.success) {
                addMessage('assistant', data.message);
            } else {
                addMessage('assistant', `Chat Error: ${data.message}`);
            }

        } else {
            // Image Generation Mode
            const requestBody = {
                message: userPrompt,
                service: currentService,
                aspect_ratio: aspectRatioSelect.value,
                image_size: imageSizeSelect.value
            };

            if (currentService === 'gemini-image') {
                requestBody.model = modelSelect.value;
            }

            if (referenceImage) {
                requestBody.reference_image = referenceImage;
            }

            response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            data = await response.json();

            removeLoadingMessage(loadingId);

            if (data.success) {
                // Handle image response (same as before)
                let imageUrl = null;
                if (data.image_url) {
                    imageUrl = data.image_url;
                } else if (data.image_data) {
                    const mimeType = (data.metadata && (data.metadata.mime_type || data.metadata.mimeType)) || 'image/png';
                    let imagePayload = data.image_data || '';
                    if (imagePayload.startsWith('data:')) {
                        imageUrl = imagePayload;
                    } else {
                        let cleanedData = imagePayload.replace(/\s+/g, '');
                        const paddingNeeded = cleanedData.length % 4;
                        if (paddingNeeded) {
                            cleanedData = cleanedData.padEnd(cleanedData.length + (4 - paddingNeeded), '=');
                        }
                        imageUrl = `data:${mimeType};base64,${cleanedData}`;
                    }
                }
                const message = data.message || `图片生成成功 (${aspectRatioSelect.value}, ${imageSizeSelect.value})`;
                addMessage('assistant', message, imageUrl, data.metadata);
            } else {
                addMessage('assistant', `生成失败: ${data.message}`, null);
            }
        }

    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage(loadingId);
        addMessage('assistant', `发生错误: ${error.message}。请确保后端服务正在运行。`, null);
    }

    scrollToBottom();
}

// Add message to chat
function addMessage(sender, text, imageUrl = null, metadata = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const avatar = sender === 'user' ? '你' : 'AI';
    const senderName = sender === 'user' ? '你' : 'AI 助手';

    let imageHtml = '';
    if (imageUrl) {
        imageHtml = `
            <div class="message-image">
                <img src="${imageUrl}" alt="Generated image" loading="lazy">
            </div>
        `;
    }

    let metadataHtml = '';
    if (metadata && sender === 'assistant') {
        const metaItems = [];
        if (metadata.aspect_ratio) {
            metaItems.push(`<small><strong>宽高比:</strong> ${metadata.aspect_ratio}</small>`);
        }
        if (metadata.image_size) {
            metaItems.push(`<small><strong>清晰度:</strong> ${metadata.image_size}</small>`);
        }
        if (metadata.model) {
            metaItems.push(`<small><strong>模型:</strong> ${metadata.model}</small>`);
        }
        if (metaItems.length > 0) {
            metadataHtml = `<div style="margin-top: 8px; color: var(--text-tertiary);">${metaItems.join(' | ')}</div>`;
        }
    }

    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">${avatar}</div>
            <div class="message-sender">${senderName}</div>
        </div>
        <div class="message-content">
            ${text ? `<div class="message-text">${escapeHtml(text)}</div>` : ''}
            ${imageHtml}
            ${metadataHtml}
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    const messageContent = messageDiv.querySelector('.message-content');

    if (imageUrl && messageContent && sender === 'assistant') {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        const downloadBtn = document.createElement('button');
        downloadBtn.type = 'button';
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = '下载图片';
        downloadBtn.addEventListener('click', () => downloadImage(imageUrl));

        actionsDiv.appendChild(downloadBtn);
        messageContent.appendChild(actionsDiv);
    }

    chatHistory.push({ sender, text, imageUrl, metadata });

    return messageDiv;
}

// Add loading message
function addLoadingMessage() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.id = `loading-${Date.now()}`;

    loadingDiv.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">AI</div>
            <div class="message-sender">AI 助手</div>
        </div>
        <div class="message-content">
            <div class="loading-indicator">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            </div>
        </div>
    `;

    messagesContainer.appendChild(loadingDiv);
    scrollToBottom();

    return loadingDiv.id;
}

// Remove loading message
function removeLoadingMessage(loadingId) {
    const loadingDiv = document.getElementById(loadingId);
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Start new chat
function startNewChat() {
    messagesContainer.innerHTML = '';
    messagesContainer.classList.remove('active');
    welcomeScreen.style.display = 'flex';
    chatHistory = [];
    messageInput.value = '';
    removeImage();
    currentImageDataUrl = null;
    validateInput();
}

// Scroll to bottom
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show error
function showError(message) {
    alert(message); // You can replace this with a better notification system
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateServiceOptions(services) {
    if (!serviceSelect) return;
    const options = Array.from(serviceSelect.options);
    options.forEach(option => {
        const service = services.find(s => s.id === option.value);
        if (service) {
            option.disabled = !service.available;
            option.title = service.available ? '' : '服务未配置 API 密钥';
        }
    });

    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    if (selectedOption && selectedOption.disabled) {
        const fallback = options.find(opt => !opt.disabled);
        if (fallback) {
            serviceSelect.value = fallback.value;
            handleServiceChange();
        }
    }
}

// Download generated image
async function downloadImage(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error('无法下载图片');
        }
        const blob = await response.blob();
        const extension = (blob.type && blob.type.split('/')[1]) || 'png';
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `ai-image-${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download failed:', error);
        // Fallback: open image in new tab so the user can save manually
        try {
            window.open(imageUrl, '_blank');
        } catch (openError) {
            console.error('Fallback open failed:', openError);
            showError('下载图片失败，请尝试右键另存为或稍后再试。');
        }
    }
}

// Check API status
async function checkAPIStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        const data = await response.json();
        console.log('API Status:', data);

        // Check if Gemini service is available
        const servicesResponse = await fetch(`${API_BASE_URL}/api/services`);
        const servicesData = await servicesResponse.json();
        const serviceList = servicesData.services || [];
        updateServiceOptions(serviceList);

        const geminiService = serviceList.find(s => s.id === 'gemini-image');
        if (geminiService && !geminiService.available) {
            console.warn('Gemini 服务未配置 API 密钥');
            showError('Gemini 服务未配置。请在 backend/.env 文件中添加 GEMINI_API_KEY');
        }

        const doubaoService = serviceList.find(s => s.id === 'doubao-image');
        if (doubaoService && !doubaoService.available) {
            console.warn('Doubao 服务未配置 API 密钥');
        }

        const chatService = serviceList.find(s => s.id === 'chat');
        if (chatService && !chatService.available) {
            console.warn('Chat 服务未配置 API 密钥');
        }

    } catch (error) {
        console.warn('无法连接到后端服务，请确保后端正在运行:', error);
        showError('无法连接到后端服务。请确保后端服务正在运行 (http://localhost:8000)');
    }
}

// Auto-save chat history (optional)
function saveChatHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

// Load chat history (optional)
function loadChatHistory() {
    const saved = localStorage.getItem('chatHistory');
    if (saved) {
        chatHistory = JSON.parse(saved);
        // Render saved messages
        chatHistory.forEach(msg => {
            addMessage(msg.sender, msg.text, msg.imageUrl, msg.metadata);
        });
        if (chatHistory.length > 0) {
            welcomeScreen.style.display = 'none';
            messagesContainer.classList.add('active');
        }
    }
}
