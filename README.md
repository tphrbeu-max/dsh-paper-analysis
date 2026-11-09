# dsh-paper-analysis（试卷分析）

DeepSeek Harness 插件：上传试卷扫描件/照片/PDF，AI 自动识别逐题得分、题型与知识点（对齐 K12 标准知识图谱），生成逐题截图；在面板中核对修改、标注错误原因（5 大类 20 细因），归档历史记录，并通过学情看板查看知识点先修关系图与掌握情况。

## 功能

- **扫描件识别**：上传图片或 PDF（自动转逐页图片），AI 逐页识别试卷信息、逐题得分与知识点，面板实时显示进度
- **逐题截图**：识别时按题目位置自动裁剪，面板每题可点开查看原题截图
- **知识点标准化**：内置 [cn-k12-dxyc2286](https://github.com/grantleyzyf-spec/cn-k12-dxyc2286) 知识图谱（高中 7 科 1000+ 知识点、真实先修关系），识别时 AI 从标准清单选名，导入时相似度自动吸附，面板编辑时提供可滚动、可过滤的下拉补全
- **题型得分率统计**：按题型聚合得分率条形图，自动筛出失分题并就地标注错误原因（知识/审题/过程/表达/习惯 5 大类 × 4 细因）
- **历史记录**：一键归档，随时查看/修改/删除，记录详情直接编辑覆盖保存
- **学情看板**：按科目展示知识点关系图（箭头 = 先修关系），节点按得分率着色（绿/黄/红/灰），点击节点查看该知识点的所有相关题目与答题情况

## 安装

需要 DeepSeek Harness ≥ 0.2.x（桌面端或 Web 均可）：

```bash
dsh plugin --profile <你的profile> add github:<owner>/dsh-paper-analysis
```

PDF 支持需要本机有一个安装了 PyMuPDF 的 Python（用于 PDF 转图片和题目裁剪）：

```bash
pip install pymupdf
```

插件会依次探测 `PAPER_ANALYSIS_PYTHON` 环境变量、Anaconda、`python`、`py`。只上传图片则无需 Python。

## 使用

1. 侧边栏打开「试卷分析」面板，点击「上传试卷（图片/PDF）」
2. 等待 AI 识别完成（进度卡片实时更新），数据自动出现在下方
3. 在逐题清单中核对得分与知识点，失分行直接标注错误原因；点「截图」对照原题
4. 点「保存结果」归档；「历史记录」回看；「学情看板」查看知识点掌握情况

也可以在对话中直接发送试卷图片/PDF 并说「分析试卷」。

## 数据存储

全部本地存储，无网络依赖：

| 位置 | 内容 |
|---|---|
| 插件目录 `analysis.data.json` | 当前草稿 |
| 插件目录 `records.data.json` | 历史记录 |
| 插件目录 `scan.data.json` | 扫描任务进度 |
| 插件目录 `crops/` | 逐题截图 PNG |
| `<工作区>/paper-scans/` | 上传的原始扫描件与页图 |

## 开发

```bash
# 语法检查 + host 端冒烟测试（工具流转、路由、看板聚合）
node test/smoke.mjs

# 从 cn-k12 topics.json 重新构建 assets/kg-high.json（需先下载 topics.json 到 kg-src/）
node test/build-kg.mjs
```

## 致谢与许可

- 本插件代码以 [MIT](LICENSE) 协议发布
- `assets/kg-high.json` 派生自 [grantleyzyf-spec/cn-k12-dxyc2286](https://github.com/grantleyzyf-spec/cn-k12-dxyc2286)（Apache-2.0），仅提取高中必修/选择性必修部分并按名称去重，详见 [NOTICE](NOTICE)
