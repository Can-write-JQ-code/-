# AI 图片生成聊天平台

一个仿 Gemini 风格的 AI 图片生成聊天界面，集成多个 AI 图片生成服务（DALL-E、Stable Diffusion 等）。

![Project Preview](https://via.placeholder.com/800x400/667eea/ffffff?text=AI+Image+Generation+Chat)

## ✨ 特性

- 🎨 **Gemini 风格界面** - 现代化、简洁的聊天界面设计
- 🤖 **多 AI 服务聚合** - 支持 DALL-E 3、Stable Diffusion、Gemini Image (中转) 以及豆包 Seedream 4.0
- 📸 **图片上传** - 支持上传图片作为输入，可直接用于 Gemini / 豆包的图生图
- 💬 **实时聊天** - 流畅的对话体验
- 🎯 **示例提示词** - 快速开始的示例卡片
- 📱 **响应式设计** - 支持桌面和移动设备

## 🏗️ 项目结构

```
AI_images/
├── backend/                 # Python FastAPI 后端
│   ├── services/           # AI 服务集成
│   │   ├── __init__.py
│   │   ├── base.py        # 基础服务类
│   │   ├── dalle.py       # DALL-E 集成
│   │   ├── stable_diffusion.py  # Stable Diffusion 集成
│   │   ├── gemini_image.py      # Gemini 图片生成
│   │   └── doubao_image.py      # 豆包 Seedream 4.0
│   ├── main.py            # FastAPI 主服务器
│   ├── requirements.txt   # Python 依赖
│   └── .env.example       # 环境变量模板
└── frontend/               # 前端界面
    ├── index.html         # 主页面
    ├── style.css          # 样式文件
    └── script.js          # JavaScript 逻辑
```

## 🚀 快速开始

### 前置要求

- Python 3.8+
- 现代浏览器（Chrome、Firefox、Safari、Edge）
- AI 服务 API 密钥（可选，用于实际图片生成）

### 1. 安装后端

```bash
# 进入后端目录
cd backend

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加你的 API 密钥
```

### 2. 配置 API 密钥

编辑 `backend/.env` 文件：

```env
# OpenAI API Key (用于 DALL-E)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Stability AI API Key (用于 Stable Diffusion)
STABILITY_API_KEY=sk-your-stability-api-key-here

# Gemini API Key (用于 Google Gemini 图片生成中转站)
GEMINI_API_KEY=sk-your-gemini-key-here
GEMINI_BASE_URL=https://yunwu.ai
GEMINI_MODEL=gemini-2.5-flash-image
GEMINI_AUTH_MODE=auto

# Doubao API Key (用于豆包 Seedream 4.0)
DOUBAO_API_KEY=sk-your-doubao-key-here
DOUBAO_BASE_URL=https://yunwu.ai
DOUBAO_MODEL=doubao-seedream-4-0-250828

# 服务器配置
HOST=0.0.0.0
PORT=8000
DEBUG=True

# CORS 设置
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5500
```

> **注意**: 如果没有 API 密钥，服务仍然可以运行，但无法实际生成图片。你可以先测试界面和 API 结构。

### 3. 启动后端服务

```bash
cd backend
python main.py
```

后端将在 `http://localhost:8000` 启动。

### 4. 启动前端

有多种方式启动前端：

**方法 1: 使用 Python 简单 HTTP 服务器**
```bash
cd frontend
python -m http.server 5500
```
然后访问 `http://localhost:5500`

**方法 2: 使用 VS Code Live Server**
- 安装 Live Server 扩展
- 右键点击 `index.html`
- 选择 "Open with Live Server"

**方法 3: 直接打开文件**
- 直接在浏览器中打开 `frontend/index.html`
- 注意：某些功能可能受 CORS 限制

## 📖 API 文档

### 端点列表

#### `GET /`
健康检查和服务状态

**响应示例:**
```json
{
  "status": "online",
  "message": "AI Image Generation API",
  "available_services": ["dalle", "stable-diffusion", "gemini-image", "doubao-image"]
}
```

#### `GET /api/services`
获取可用的 AI 服务列表

**响应示例:**
```json
{
  "services": [
    {
      "id": "dalle",
      "name": "DALL-E 3",
      "available": true
    },
    {
      "id": "stable-diffusion",
      "name": "Stable Diffusion XL",
      "available": false
    }
  ]
}
```

#### `POST /api/chat`
发送聊天消息并生成图片

**请求体:**
```json
{
  "message": "一只可爱的柴犬在樱花树下玩耍",
  "service": "gemini-image",
  "model": "gemini-2.5-flash-image",
  "aspect_ratio": "1:1",
  "image_size": "1K",
  "reference_image": "data:image/png;base64,..."  // 可选：上传图片后自动填充
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "Image generated using DALL-E 3",
  "image_url": "https://...",
  "metadata": {
    "revised_prompt": "...",
    "size": "1024x1024",
    "quality": "standard"
  },
  "service": "dalle"
}
```

#### `POST /api/generate`
使用特定参数生成图片

**请求体:**
```json
{
  "prompt": "未来科技城市，霓虹灯光",
  "service": "doubao-image",
  "aspect_ratio": "16:9",
  "image_size": "2K",
  "reference_image": null
}
```

#### `POST /api/upload`
上传图片（为未来功能预留）

**请求**: multipart/form-data with file

## 🎨 使用说明

1. **选择 AI 服务**: 在左侧边栏底部选择要使用的 AI 服务
2. **输入提示词**: 在底部输入框中描述你想要生成的图片
3. **可选：上传参考图**: 点击回形针上传图片，Gemini / 豆包服务会将其作为图生图参考
4. **点击示例**: 或点击欢迎页面的示例卡片快速开始
4. **上传图片**: 点击附件按钮上传图片（可选）
5. **发送**: 点击发送按钮或按 Enter 键生成图片
6. **新对话**: 点击左上角的"新对话"按钮开始新的会话

## 🔧 自定义配置

### 添加新的 AI 服务

1. 在 `backend/services/` 创建新的服务文件
2. 继承 `AIServiceBase` 类
3. 实现 `generate_image()` 和 `get_service_name()` 方法
4. 在 `backend/main.py` 中注册服务

示例：
```python
from services.base import AIServiceBase

class MyAIService(AIServiceBase):
    def __init__(self, api_key=None):
        super().__init__(api_key)
    
    async def generate_image(self, prompt: str, **kwargs):
        # 实现你的生成逻辑
        return {
            "success": True,
            "image_url": "..."
        }
    
    def get_service_name(self) -> str:
        return "My AI Service"
```

### 修改前端样式

编辑 `frontend/style.css` 中的 CSS 变量：

```css
:root {
    --accent-blue: #1a73e8;  /* 主题色 */
    --accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    /* ... 更多变量 */
}
```

## 🛠️ 技术栈

**后端:**
- FastAPI - 现代、快速的 Web 框架
- Uvicorn - ASGI 服务器
- httpx - 异步 HTTP 客户端
- Pillow - 图片处理
- python-dotenv - 环境变量管理

**前端:**
- 原生 HTML/CSS/JavaScript
- Google Fonts - 字体
- Fetch API - HTTP 请求

## 📝 开发计划

- [ ] 添加更多 AI 服务（Midjourney、Leonardo.ai 等）
- [ ] 实现图生图功能
- [ ] 添加聊天历史持久化
- [ ] 支持深色/浅色主题切换
- [ ] 添加图片下载功能
- [ ] 实现用户认证系统
- [ ] 添加图片编辑功能
- [ ] WebSocket 实时通信

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- 界面设计灵感来自 [Google Gemini](https://gemini.google.com)
- AI 服务提供商：OpenAI、Stability AI

---

**注意**: 使用 AI 图片生成服务需要相应的 API 密钥，并可能产生费用。请查看各服务商的定价政策。
