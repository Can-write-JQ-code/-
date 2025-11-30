@echo off
echo 🚀 AI 图片生成聊天平台 - 快速启动脚本
echo ==========================================
echo.

REM 检查是否在正确的目录
if not exist "backend\main.py" (
    echo ❌ 错误: 请在项目根目录运行此脚本
    exit /b 1
)

REM 创建 .env 文件（如果不存在）
if not exist "backend\.env" (
    echo 📝 创建环境变量文件...
    copy backend\.env.example backend\.env
    echo ✅ 已创建 backend\.env 文件
    echo ⚠️  请编辑 backend\.env 文件，添加你的 API 密钥
    echo.
)

REM 安装后端依赖
echo 📦 安装后端依赖...
cd backend
python -m pip install -r requirements.txt
if %errorlevel% equ 0 (
    echo ✅ 后端依赖安装完成
) else (
    echo ❌ 后端依赖安装失败
    exit /b 1
)
cd ..

echo.
echo ==========================================
echo ✅ 设置完成！
echo.
echo 📖 使用说明:
echo 1. 编辑 backend\.env 文件，添加你的 API 密钥（可选）
echo 2. 启动后端: cd backend ^&^& python main.py
echo 3. 在浏览器中打开: frontend\index.html
echo.
echo 🌐 后端地址: http://localhost:8000
echo 📚 API 文档: http://localhost:8000/docs
echo.
pause
