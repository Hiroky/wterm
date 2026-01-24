@echo off
setlocal

echo wterm - ビルドセットアップ
echo ================================
echo.

cd /d "%~dp0"

echo 依存関係をインストール中...
call npm install

if %ERRORLEVEL% neq 0 (
    echo.
    echo エラー: 依存関係のインストールに失敗しました
    pause
    exit /b 1
)

echo.
echo クライアントの依存関係をインストール中...
cd client
call npm install

if %ERRORLEVEL% neq 0 (
    echo.
    echo エラー: クライアントの依存関係のインストールに失敗しました
    pause
    exit /b 1
)

cd ..

echo.
echo フロントエンドをビルド中...
call npm run build:client

if %ERRORLEVEL% neq 0 (
    echo.
    echo エラー: ビルドに失敗しました
    pause
    exit /b 1
)

echo.
echo 完了しました。
