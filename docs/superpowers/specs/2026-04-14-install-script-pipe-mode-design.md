# 安装脚本管道模式交互修复设计

## 概述

修复 Linux/macOS 安装脚本在管道模式（`curl | bash`）下无法接收用户输入的问题。

## 问题分析

当用户通过管道执行脚本时：
```bash
curl -sSL <server>/api/public/scripts/install-skill.sh | bash -s -- <slug>
```

`read` 命令从 stdin 读取，但 stdin 已被管道占用，导致：
- 无法接收用户输入
- 脚本直接显示 "Cancelled" 退出

## 解决方案

### 方案：/dev/tty

从 `/dev/tty` 读取输入，绕过 stdin 管道限制。

### 修改内容

**文件**: `packages/backend/scripts/install-skill.sh`

**修改位置**: 第 50-56 行

```bash
# 修改前
read -p "Overwrite? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi
rm -rf "$INSTALL_DIR"

# 修改后
if ! read -p "Overwrite? [y/N] " -n 1 -r < /dev/tty; then
    echo "Cancelled (cannot read from terminal)"
    exit 0
fi
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi
rm -rf "$INSTALL_DIR"
```

### 行为对比

| 执行方式 | 修改前 | 修改后 |
|----------|--------|--------|
| `curl \| bash` | 直接取消 | 正常提示确认 |
| `./install-skill.sh` | 正常 | 正常 |
| 非交互环境 | 挂起/取消 | 明确错误提示 |

### 不涉及修改

PowerShell 脚本 (`install-skill.ps1`) 不受此问题影响。
