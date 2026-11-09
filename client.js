window.__ModuleLoader__.load({
  id: '@local/paper-analysis',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback } = React;

    const EXAM_TYPES = ['月考', '期中', '期末', '其他'];

    // 错误原因两级体系（大类 + 子原因 + 说明），来自《分析模板.xlsx》「典型错误原因」。
    const ERROR_TAXONOMY = [
      {
        key: '知识失分', tag: '不会', reasons: [
          ['概念不清', '对定义、定理、公式的理解停留在表面，换个问法就错'],
          ['知识遗忘', '公式记错、条件记漏、该记住的没记住'],
          ['知识盲区', '知识点压根没学过或没学会，连考什么都识别不出'],
          ['迁移失败', '知识本身会，换个新情境就认不出、用不上'],
        ],
      },
      {
        key: '审题失分', tag: '看错', reasons: [
          ['漏看条件', '题干给了的条件没用到'],
          ['看错设问', '问东答西，如“不正确的是”看成“正确的是”'],
          ['漏看限定', '跳读漏掉“至少”“不超过”“取值范围”等关键约束'],
          ['误读信息', '图表看错、单位看错、隐含条件没挖出来'],
        ],
      },
      {
        key: '过程失分', tag: '会而做错', reasons: [
          ['计算错误', '符号、进位、抄错数，一步错步步错'],
          ['方法不当', '选错公式或走了弯路，导致错解或做不完'],
          ['跳步心算', '中间过程全靠脑算，错在其中又无法定位'],
          ['思路卡壳', '方向对了但中途断掉，只写了一半'],
        ],
      },
      {
        key: '表达失分', tag: '对而不全', reasons: [
          ['采分缺失', '结果对了但关键步骤没写，被扣过程分'],
          ['表述不严', '口语代替术语，逻辑链有断点'],
          ['书写失范', '字迹潦草、卷面混乱、答题卡涂错导致误判'],
          ['答非所问', '内容没错但没对准设问角度，采分点对不上'],
        ],
      },
      {
        key: '习惯失分', tag: '不该错', reasons: [
          ['粗心大意', '审题、计算、誊写中的注意力失误'],
          ['惯性思维', '题眼熟就套旧解法，忽略题目已变'],
          ['誊抄错位', '草稿和答题位置对不上，答案抄串'],
          ['紧张空白', '平时会做的题，考场上大脑空白'],
        ],
      },
    ];

    const ZH = {
      title: '试卷分析',
      upload: '上传试卷（图片/PDF）',
      saveRecord: '保存结果',
      saving: '保存中…',
      savedOk: '已保存到历史记录。',
      saveFailed: '保存失败，请重试',
      history: '历史记录',
      backToDraft: '返回当前分析',
      backToHistory: '返回历史列表',
      clear: '清空草稿',
      clearConfirm: '确定清空当前草稿的全部分析数据吗？（历史记录不受影响）',
      refresh: '刷新',
      emptyTitle: '还没有分析数据',
      emptyStep1: '1. 点击「上传试卷（图片/PDF）」选择试卷扫描 PDF 或照片，助手会自动识别试卷内容：逐题得分、题型与知识点映射；也可以直接在对话中发送试卷文件并说「分析试卷」。',
      emptyStep2: '2. 分析完成后，在下方核对逐题得分与题型得分率，并在错题列表中为每道错题确认知识点、标注错误原因。',
      emptyStep3: '3. 点击「保存结果」把本次分析归档到历史记录，随时可以回看和继续修改。',
      paper: '试卷信息',
      paperTitle: '试卷标题',
      paperTitlePh: '如：2026 高一数学期中试卷',
      subject: '科目',
      examType: '考试类型',
      examDate: '考试日期',
      score: '总得分',
      totalScore: '满分',
      pleaseSelect: '请选择',
      typeStats: '各题型得分率统计',
      typeName: '题型',
      typeCount: '题数',
      scoreRatio: '得分/满分',
      scoreRate: '得分率',
      questions: '逐题得分明细',
      wrongList: '错题列表',
      no: '题号',
      type: '题型',
      lost: '失分',
      kpName: '知识点',
      kpPh: '如：函数零点与建模',
      errorReason: '错误原因',
      reasonCategoryPh: '错误大类',
      reasonSubPh: '具体原因',
      note: '备注',
      notePh: '可选',
      viewImage: '截图',
      addQuestion: '添加题目',
      deleteRow: '删除',
      noWrong: '没有失分题，全部答对！',
      wrongNeedKp: '待补知识点',
      taxonomyRef: '错误原因对照表（填错因时参考）',
      reviewPlan: '复习计划',
      overallRate: '总得分率',
      updated: '更新于',
      loadFailed: '数据加载失败，点击刷新重试',
      clearDone: '已清空草稿',
      scanNotified: '扫描件已上传，助手正在自动识别分析，稍候数据会自动出现在下方。',
      scanSaved: '扫描件已保存（未检测到活动会话，请在对话中发送「分析试卷」）：',
      scanPdfNoConvert: 'PDF 已保存，但本机未找到可用的 PDF 转换工具（需要安装了 PyMuPDF 的 Python），请改用图片上传：',
      scanFailed: '上传失败：',
      progressTitle: '分析进度',
      stagePending: '待启动',
      stageRendering: '正在转换 PDF…',
      stageNotified: '已发送给助手，等待开始…',
      stageAnalyzing: '识别中…',
      stageDone: '已完成',
      stageError: '出错了',
      startAnalysis: '开始分析',
      restartAnalysis: '重新启动分析',
      dismiss: '忽略',
      startNoSession: '未检测到活动会话：请在对话中发送「分析试卷」，或稍后再点击「开始分析」。',
      restartHint: '如果长时间没有动静，可以点击「重新启动分析」。',
      elapsed: '开始于',
      historyEmpty: '还没有历史记录。完成一次分析后点击「保存结果」即可归档。',
      historyTitleCol: '标题',
      historyWrong: '错题数',
      historySavedAt: '保存时间',
      historyOpen: '查看',
      historyDelete: '删除',
      historyDeleteConfirm: '确定删除这条历史记录吗？删除后不可恢复。',
      recordEditing: '正在编辑历史记录，修改会自动保存并覆盖该记录。',
      untitled: '未命名试卷',
      kpDashboard: '学情看板',
      dashEmpty: '暂无学情数据：保存至少一份分析结果后，这里会按知识点汇总掌握情况。',
      dashHint: '节点颜色表示得分率：绿色 ≥85%，黄色 60-85%，红色 <60%，灰色虚线暂无数据；箭头表示先修关系（A → B 表示 A 是 B 的基础）。点击知识点查看相关题目。',
      legendNone: '暂无数据',
      relatedQ: '相关题目',
      paperCol: '试卷',
      legend: '图例',
    };
    const EN = {
      title: 'Paper analysis',
      upload: 'Upload paper (image/PDF)',
      saveRecord: 'Save result',
      saving: 'Saving…',
      savedOk: 'Saved to history.',
      saveFailed: 'Save failed, please retry',
      history: 'History',
      backToDraft: 'Back to current analysis',
      backToHistory: 'Back to history',
      clear: 'Clear draft',
      clearConfirm: 'Clear all data of the current draft? (History records are not affected)',
      refresh: 'Refresh',
      emptyTitle: 'No analysis yet',
      emptyStep1: '1. Click "Upload paper (image/PDF)" and choose a scanned PDF or photos; the assistant will recognize per-question scores, types and knowledge points automatically. You can also send the file in the chat and say "analyze this paper".',
      emptyStep2: '2. When the analysis arrives, review per-question scores and per-type score rates, then confirm knowledge points and annotate error reasons in the wrong-question list.',
      emptyStep3: '3. Click "Save result" to archive this analysis into history; you can review and keep editing it any time.',
      paper: 'Paper info',
      paperTitle: 'Title',
      paperTitlePh: 'e.g. 2026 Grade-10 Math Midterm',
      subject: 'Subject',
      examType: 'Exam type',
      examDate: 'Exam date',
      score: 'Score',
      totalScore: 'Full score',
      pleaseSelect: 'Select…',
      typeStats: 'Score rate by question type',
      typeName: 'Type',
      typeCount: 'Questions',
      scoreRatio: 'Score/Full',
      scoreRate: 'Score rate',
      questions: 'Per-question scores',
      wrongList: 'Wrong questions',
      no: 'No.',
      type: 'Type',
      lost: 'Lost',
      kpName: 'Knowledge point',
      kpPh: 'e.g. Function zeros',
      errorReason: 'Error reason',
      reasonCategoryPh: 'Category',
      reasonSubPh: 'Detail',
      note: 'Note',
      notePh: 'Optional',
      viewImage: 'Image',
      addQuestion: 'Add question',
      deleteRow: 'Delete',
      noWrong: 'No marks lost — all correct!',
      wrongNeedKp: 'Knowledge point missing',
      taxonomyRef: 'Error-reason reference (for annotation)',
      reviewPlan: 'Review plan',
      overallRate: 'Overall score rate',
      updated: 'Updated',
      loadFailed: 'Failed to load data. Click refresh to retry.',
      clearDone: 'Draft cleared',
      scanNotified: 'Scan uploaded. The assistant is analyzing it; the data will appear below shortly.',
      scanSaved: 'Scan saved (no live session detected — send "analyze this paper" in the chat): ',
      scanPdfNoConvert: 'PDF saved, but no PDF converter is available on this machine (a Python with PyMuPDF is required). Please upload images instead: ',
      scanFailed: 'Upload failed: ',
      progressTitle: 'Analysis progress',
      stagePending: 'Waiting to start',
      stageRendering: 'Converting PDF…',
      stageNotified: 'Sent to the assistant, waiting…',
      stageAnalyzing: 'Recognizing…',
      stageDone: 'Done',
      stageError: 'Failed',
      startAnalysis: 'Start analysis',
      restartAnalysis: 'Restart analysis',
      dismiss: 'Dismiss',
      startNoSession: 'No live session detected: send "analyze this paper" in the chat, or click "Start analysis" again later.',
      restartHint: 'If nothing happens for a while, click "Restart analysis".',
      elapsed: 'Started at',
      historyEmpty: 'No history yet. Finish an analysis and click "Save result" to archive it.',
      historyTitleCol: 'Title',
      historyWrong: 'Wrong',
      historySavedAt: 'Saved at',
      historyOpen: 'Open',
      historyDelete: 'Delete',
      historyDeleteConfirm: 'Delete this history record? This cannot be undone.',
      recordEditing: 'Editing a history record: changes are auto-saved and overwrite this record.',
      untitled: 'Untitled paper',
      kpDashboard: 'Knowledge dashboard',
      dashEmpty: 'No data yet: save at least one analysis and the mastery by knowledge point will appear here.',
      dashHint: 'Node color = score rate: green ≥85%, yellow 60-85%, red <60%, dashed gray = no data. Arrows show prerequisite relations (A → B). Click a node to see related questions.',
      legendNone: 'No data',
      relatedQ: 'Related questions',
      paperCol: 'Paper',
      legend: 'Legend',
    };
    let translate = (key) => ZH[key] || key;
    const t = (key) => translate(key);

    const CSS = `
.pa-page{box-sizing:border-box;width:100%;min-height:100%;padding:20px 24px 48px;overflow-y:auto;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.6}
.pa-wrap{max-width:1080px;margin:0 auto}
.pa-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.pa-title{font-size:18px;font-weight:600;flex:1;min-width:120px}
.pa-btn{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 14px;font-size:13px;cursor:pointer;white-space:nowrap}
.pa-btn:hover{border-color:var(--dsw-alias-border-l2)}
.pa-btn-primary{background:var(--dsw-alias-state-info-primary,#247bbf);border-color:transparent;color:#fff}
.pa-btn-danger{color:var(--dsw-alias-state-error-primary)}
.pa-btn[disabled]{opacity:.6;cursor:default}
.pa-notice{margin:0 0 12px;padding:8px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:12px;word-break:break-all}
.pa-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:14px 16px;margin-bottom:14px}
.pa-card-title{font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px 16px}
.pa-field{display:flex;flex-direction:column;gap:3px}
.pa-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.pa-input{border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:4px 8px;font-size:13px;font-family:inherit}
.pa-input:focus{outline:none;border-color:var(--dsw-alias-border-l2)}
select.pa-input{padding:3px 6px}
textarea.pa-input{min-height:96px;resize:vertical;width:100%;box-sizing:border-box}
.pa-table{width:100%;border-collapse:collapse;font-size:12px}
.pa-table th{text-align:left;color:var(--dsw-alias-label-secondary);font-weight:500;padding:4px 6px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}
.pa-table td{padding:4px 6px;border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:top}
.pa-table .pa-input{width:100%;box-sizing:border-box;padding:2px 6px;font-size:12px}
.pa-num{width:58px}
.pa-badge{display:inline-block;min-width:22px;text-align:center;border-radius:6px;padding:0 6px;font-size:11px;line-height:20px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}
.pa-badge-lost{background:var(--dsw-alias-state-error-primary);border-color:transparent;color:#fff}
.pa-rate{font-variant-numeric:tabular-nums;white-space:nowrap}
.pa-rate-low{color:var(--dsw-alias-state-error-primary);font-weight:600}
.pa-bar-row{display:grid;grid-template-columns:150px 1fr 110px;align-items:center;gap:10px;margin-bottom:6px}
.pa-bar-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pa-bar-track{height:8px;border-radius:4px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.pa-bar-fill{height:100%;border-radius:4px;background:var(--dsw-alias-state-success-primary,#3a9b6d)}
.pa-bar-fill-low{background:var(--dsw-alias-state-error-primary)}
.pa-bar-val{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);font-size:12px}
.pa-row-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.pa-link{background:none;border:none;color:var(--dsw-alias-state-info-primary,#247bbf);cursor:pointer;font-size:12px;padding:0}
.pa-link-danger{color:var(--dsw-alias-state-error-primary)}
.pa-foot{color:var(--dsw-alias-label-secondary);font-size:11px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pa-empty{color:var(--dsw-alias-label-secondary);padding:6px 2px}
.pa-empty ol{margin:6px 0 0;padding-left:20px}
.pa-del{visibility:hidden}
.pa-table tr:hover .pa-del{visibility:visible}
.pa-progress-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pa-progress-file{color:var(--dsw-alias-label-secondary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40%}
.pa-chip-status{border-radius:7px;padding:1px 9px;font-size:11px;line-height:18px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.pa-chip-active{background:var(--dsw-alias-state-info-primary,#247bbf);border-color:transparent;color:#fff}
.pa-chip-done{background:var(--dsw-alias-state-success-primary,#3a9b6d);border-color:transparent;color:#fff}
.pa-chip-error{background:var(--dsw-alias-state-error-primary);border-color:transparent;color:#fff}
.pa-progress-track{height:6px;border-radius:3px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;margin:10px 0 6px}
.pa-progress-fill{height:100%;border-radius:3px;background:var(--dsw-alias-state-info-primary,#247bbf);transition:width .4s ease}
.pa-progress-note{color:var(--dsw-alias-label-secondary);font-size:12px;min-height:18px;word-break:break-all}
.pa-progress-actions{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
.pa-spinner{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid var(--dsw-alias-border-l1);border-top-color:var(--dsw-alias-state-info-primary,#247bbf);animation:pa-spin .8s linear infinite;vertical-align:-2px}
@keyframes pa-spin{to{transform:rotate(360deg)}}
.pa-reasons-cell{display:flex;flex-direction:column;gap:4px;min-width:150px}
.pa-ref summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:12px;user-select:none}
.pa-ref-cat{margin:8px 0 2px;font-weight:600;font-size:12px}
.pa-ref-tag{color:var(--dsw-alias-label-secondary);font-weight:400}
.pa-ref-item{margin:2px 0 2px 12px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.pa-ref-item b{color:var(--dsw-alias-label-primary);font-weight:500}
.pa-hist-title{font-weight:500}
.pa-hist-sub{color:var(--dsw-alias-label-secondary);font-size:11px}
.pa-warn{color:var(--dsw-alias-state-error-primary);font-size:11px}
.pa-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.pa-tab{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:999px;padding:4px 16px;font-size:12px;cursor:pointer}
.pa-tab-active{background:var(--dsw-alias-state-info-primary,#247bbf);border-color:transparent;color:#fff}
.pa-graph-wrap{overflow-x:auto;padding:4px 0}
.pa-kp-node{cursor:pointer}
.pa-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary);margin:8px 0}
.pa-legend i{display:inline-block;width:12px;height:12px;border-radius:4px;margin-right:5px;vertical-align:-1px}
.pa-kp-wrap{position:relative}
.pa-kp-drop{position:absolute;top:100%;left:0;right:0;min-width:240px;max-height:220px;overflow-y:auto;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);z-index:1000;margin-top:2px}
.pa-kp-opt{padding:5px 10px;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pa-kp-opt:hover{background:var(--dsw-alias-bg-layer-2)}
.pa-kp-opt-sel{color:var(--dsw-alias-state-info-primary,#247bbf);font-weight:600}
.pa-img-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out}
.pa-img-box{background:var(--dsw-alias-bg-layer-1);border-radius:12px;padding:12px;max-width:92%;max-height:92%;display:flex;flex-direction:column;gap:8px;cursor:default}
.pa-img-box img{max-width:100%;max-height:76vh;object-fit:contain;border-radius:8px;background:#fff}
.pa-img-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;color:var(--dsw-alias-label-secondary)}
`;

    function Icon(props) {
      const size = (props && props.size) || 20;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        'aria-hidden': true, style: { display: 'block' },
      },
        h('path', {
          d: 'M6 2.5h8L19 7.5V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z',
          stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round',
        }),
        h('path', { d: 'M13.5 2.5V8H19', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' }),
        h('path', { d: 'M8 13.5l2.4 2.4L15 11.5', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        h('path', { d: 'M8 18.5h8', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
      );
    }

    const numOf = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    const pct = (ratio) => Math.round(ratio * 100) + '%';
    const lostOf = (q) => Math.min(Math.max(numOf(q.fullScore) - numOf(q.score), 0), numOf(q.fullScore) || Infinity);
    const fmtTime = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    /** 各题型得分率统计（与 host 端 statsOf 相同的口径）。 */
    function typeStatsOf(questions) {
      const byType = new Map();
      for (const q of questions) {
        const f = numOf(q.fullScore);
        const s = Math.min(Math.max(numOf(q.score), 0), f || Infinity);
        const name = q.type || '未分类';
        const agg = byType.get(name) || { type: name, score: 0, fullScore: 0, count: 0 };
        agg.score += s;
        agg.fullScore += f;
        agg.count += 1;
        byType.set(name, agg);
      }
      return Array.from(byType.values()).map((x) => ({
        ...x,
        lost: Math.max(x.fullScore - x.score, 0),
        scoreRate: x.fullScore > 0 ? x.score / x.fullScore : 0,
      }));
    }

    function Field(props) {
      return h('label', { className: 'pa-field' },
        h('span', { className: 'pa-label' }, props.label),
        h('input', {
          className: 'pa-input',
          type: props.type || 'text',
          value: props.value || '',
          placeholder: props.placeholder || '',
          onChange: (e) => props.onChange(e.target.value),
        }),
      );
    }

    function SelectField(props) {
      return h('label', { className: 'pa-field' },
        h('span', { className: 'pa-label' }, props.label),
        h('select', {
          className: 'pa-input',
          value: props.value || '',
          onChange: (e) => props.onChange(e.target.value),
        },
          h('option', { value: '' }, t('pleaseSelect')),
          props.options.map((opt) => h('option', { key: opt, value: opt }, opt)),
        ),
      );
    }

    const ACTIVE_STAGES = ['pending', 'rendering', 'notified', 'analyzing'];

    function ScanCard(props) {
      const scan = props.scan;
      const active = ACTIVE_STAGES.includes(scan.status);
      const chipClass =
        scan.status === 'done' ? 'pa-chip-status pa-chip-done'
          : scan.status === 'error' ? 'pa-chip-status pa-chip-error'
            : active && scan.status !== 'pending' ? 'pa-chip-status pa-chip-active'
              : 'pa-chip-status';
      const percent = typeof scan.percent === 'number' ? Math.round(scan.percent) : null;
      const showBar = active && scan.status !== 'pending' && percent !== null;
      const canStart = scan.status !== 'done';
      return h('div', { className: 'pa-card' },
        h('div', { className: 'pa-progress-head' },
          h('span', { className: 'pa-card-title', style: { marginBottom: 0 } }, t('progressTitle')),
          active && scan.status !== 'pending' ? h('span', { className: 'pa-spinner' }) : null,
          h('span', { className: 'pa-progress-file', title: scan.fileName }, scan.fileName || ''),
          h('span', { className: chipClass }, t('stage' + scan.status.charAt(0).toUpperCase() + scan.status.slice(1))),
          scan.updatedAt ? h('span', { className: 'pa-label' }, t('elapsed') + ' ' + fmtTime(scan.updatedAt).slice(11)) : null,
        ),
        showBar ? h('div', { className: 'pa-progress-track' },
          h('div', { className: 'pa-progress-fill', style: { width: percent + '%' } }),
        ) : null,
        h('div', { className: 'pa-progress-note' },
          scan.status === 'error'
            ? (scan.error || t('stageError'))
            : scan.note || (scan.status === 'notified' ? t('restartHint') : ''),
        ),
        h('div', { className: 'pa-progress-actions' },
          canStart ? h('button', {
            className: 'pa-btn' + (scan.status === 'pending' || scan.status === 'error' ? ' pa-btn-primary' : ''),
            disabled: props.starting,
            onClick: props.onStart,
          }, scan.status === 'notified' || scan.status === 'analyzing' ? t('restartAnalysis') : t('startAnalysis')) : null,
          h('button', { className: 'pa-btn', onClick: props.onDismiss }, t('dismiss')),
        ),
      );
    }

    /** 错误原因两级选择：大类 → 具体原因。 */
    function ReasonPicker(props) {
      const cat = ERROR_TAXONOMY.find((c) => c.key === props.category) || null;
      return h('div', { className: 'pa-reasons-cell' },
        h('select', {
          className: 'pa-input',
          value: props.category || '',
          onChange: (e) => props.onChange(e.target.value, ''),
        },
          h('option', { value: '' }, t('reasonCategoryPh')),
          ERROR_TAXONOMY.map((c) => h('option', { key: c.key, value: c.key }, `${c.key}（${c.tag}）`)),
        ),
        cat ? h('select', {
          className: 'pa-input',
          value: props.reason || '',
          onChange: (e) => props.onChange(cat.key, e.target.value),
        },
          h('option', { value: '' }, t('reasonSubPh')),
          cat.reasons.map(([name]) => h('option', { key: name, value: name }, name)),
        ) : null,
      );
    }

    /** 题目截图弹窗：点击遮罩或按钮关闭。 */
    function ImageModal(props) {
      if (!props.image) return null;
      return h('div', { className: 'pa-img-modal', onClick: props.onClose },
        h('div', { className: 'pa-img-box', onClick: (e) => e.stopPropagation() },
          h('div', { className: 'pa-img-bar' },
            h('span', null, props.title || ''),
            h('button', { className: 'pa-btn', onClick: props.onClose }, '✕'),
          ),
          h('img', { src: props.image, alt: props.title || '' }),
        ),
      );
    }

    // ---- 学情看板 ----

    const RATE_COLORS = { good: '#3a9b6d', mid: '#d9a021', bad: '#d05451' };
    function rateColor(rate) {
      if (rate === null || rate === undefined) return null;
      if (rate >= 0.85) return RATE_COLORS.good;
      if (rate >= 0.6) return RATE_COLORS.mid;
      return RATE_COLORS.bad;
    }

    /** 分层布局：按先修边计算深度（列），无边节点放最后一列。 */
    function layoutBoard(board) {
      const nodeW = 176, nodeH = 52, gapX = 72, gapY = 22, pad = 24;
      const names = board.nodes.map((n) => n.name);
      const hasIncoming = new Set();
      const hasEdge = new Set();
      board.edges.forEach(([a, b]) => { hasEdge.add(a); hasEdge.add(b); hasIncoming.add(b); });
      const depth = new Map();
      names.forEach((n) => { if (!hasIncoming.has(n) && hasEdge.has(n)) depth.set(n, 0); });
      for (let i = 0; i < names.length; i++) {
        board.edges.forEach(([a, b]) => {
          if (depth.has(a)) depth.set(b, Math.max(depth.get(b) ?? 0, depth.get(a) + 1));
        });
      }
      const maxDepth = depth.size ? Math.max(...depth.values()) : -1;
      names.forEach((n) => { if (!depth.has(n)) depth.set(n, maxDepth + 1); });
      const columns = new Map();
      names.forEach((n) => {
        const d = depth.get(n);
        if (!columns.has(d)) columns.set(d, []);
        columns.get(d).push(n);
      });
      const pos = new Map();
      for (const [d, list] of columns) {
        list.forEach((n, i) => pos.set(n, { x: pad + d * (nodeW + gapX), y: pad + i * (nodeH + gapY) }));
      }
      const maxRows = Math.max(1, ...Array.from(columns.values()).map((l) => l.length));
      const totalDepth = maxDepth + 2;
      return {
        pos,
        width: pad * 2 + (totalDepth + 1) * nodeW + totalDepth * gapX,
        height: pad * 2 + maxRows * nodeH + (maxRows - 1) * gapY,
        nodeW,
        nodeH,
      };
    }

    function Dashboard(props) {
      const [board, setBoard] = useState(null);
      const [subject, setSubject] = useState('');
      const [selected, setSelected] = useState(null);
      const [viewImg, setViewImg] = useState(null);

      const loadBoard = useCallback(() => {
        fetch('/paper-analysis/knowledge', { cache: 'no-store' })
          .then((r) => r.json())
          .then((j) => {
            setBoard(j);
            setSubject((prev) => {
              if (prev && (j.boards || []).some((b) => b.subject === prev)) return prev;
              return (j.boards || [])[0] ? j.boards[0].subject : '';
            });
          })
          .catch(() => setBoard({ boards: [], questions: {} }));
      }, []);
      useEffect(() => { loadBoard(); }, [loadBoard]);

      const current = board && (board.boards || []).find((b) => b.subject === subject);
      const layout = current ? layoutBoard(current) : null;
      const nodeByName = current ? new Map(current.nodes.map((n) => [n.name, n])) : new Map();
      const detail = selected && board ? (board.questions || {})[selected] || [] : [];
      const selNode = selected ? nodeByName.get(selected) : null;

      return h('div', null,
        h('div', { className: 'pa-head' },
          h('div', { className: 'pa-title' }, t('kpDashboard')),
          h('button', { className: 'pa-btn', onClick: props.onBack }, t('backToDraft')),
          h('button', { className: 'pa-btn', onClick: loadBoard }, t('refresh')),
        ),
        !board
          ? h('div', { className: 'pa-card' }, h('div', { className: 'pa-empty' }, '…'))
          : !(board.boards || []).length
            ? h('div', { className: 'pa-card' }, h('div', { className: 'pa-empty' }, t('dashEmpty')))
            : h(React.Fragment, null,
                h('div', { className: 'pa-tabs' },
                  board.boards.map((b) =>
                    h('button', {
                      key: b.subject,
                      className: 'pa-tab' + (b.subject === subject ? ' pa-tab-active' : ''),
                      onClick: () => { setSubject(b.subject); setSelected(null); },
                    }, b.subject),
                  ),
                ),
                h('div', { className: 'pa-card' },
                  h('div', { className: 'pa-legend' },
                    h('span', null, h('i', { style: { background: RATE_COLORS.good } }), '≥85%'),
                    h('span', null, h('i', { style: { background: RATE_COLORS.mid } }), '60-85%'),
                    h('span', null, h('i', { style: { background: RATE_COLORS.bad } }), '<60%'),
                    h('span', null, h('i', { style: { background: 'transparent', border: '1px dashed var(--dsw-alias-border-l2)' } }), t('legendNone')),
                  ),
                  h('div', { className: 'pa-label', style: { marginBottom: '8px' } }, t('dashHint')),
                  h('div', { className: 'pa-graph-wrap' },
                    h('svg', { width: layout.width, height: layout.height, style: { display: 'block' } },
                      h('defs', null,
                        h('marker', { id: 'pa-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
                          h('path', { d: 'M0,0 L10,5 L0,10 z', style: { fill: 'var(--dsw-alias-border-l2)' } }),
                        ),
                      ),
                      current.edges.map(([a, b], i) => {
                        const pa = layout.pos.get(a);
                        const pb = layout.pos.get(b);
                        if (!pa || !pb) return null;
                        return h('line', {
                          key: i,
                          x1: pa.x + layout.nodeW, y1: pa.y + layout.nodeH / 2,
                          x2: pb.x - 4, y2: pb.y + layout.nodeH / 2,
                          style: { stroke: 'var(--dsw-alias-border-l2)', strokeWidth: 1.4 },
                          markerEnd: 'url(#pa-arrow)',
                        });
                      }),
                      current.nodes.map((n) => {
                        const p = layout.pos.get(n.name);
                        const color = rateColor(n.rate);
                        const isSel = selected === n.name;
                        return h('g', { key: n.name, className: 'pa-kp-node', onClick: () => setSelected(isSel ? null : n.name) },
                          h('rect', {
                            x: p.x, y: p.y, width: layout.nodeW, height: layout.nodeH, rx: 10,
                            style: {
                              fill: color || 'var(--dsw-alias-bg-layer-1)',
                              stroke: isSel ? 'var(--dsw-alias-state-info-primary,#247bbf)' : 'var(--dsw-alias-border-l1)',
                              strokeWidth: isSel ? 2.5 : 1,
                              strokeDasharray: color ? 'none' : '5 4',
                            },
                          }),
                          h('text', {
                            x: p.x + layout.nodeW / 2, y: p.y + 21, 'text-anchor': 'middle',
                            style: { fontSize: 12, fill: color ? '#fff' : 'var(--dsw-alias-label-primary)', pointerEvents: 'none' },
                          }, n.name.length > 11 ? n.name.slice(0, 11) + '…' : n.name),
                          h('text', {
                            x: p.x + layout.nodeW / 2, y: p.y + 40, 'text-anchor': 'middle',
                            style: { fontSize: 11, fill: color ? 'rgba(255,255,255,.88)' : 'var(--dsw-alias-label-secondary)', pointerEvents: 'none' },
                          }, n.count ? `${Math.round(n.rate * 100)}%（${n.score}/${n.full} · ${n.count}题）` : t('legendNone')),
                        );
                      }),
                    ),
                  ),
                ),
                selNode ? h('div', { className: 'pa-card' },
                  h('div', { className: 'pa-card-title' },
                    `${selNode.name} · ${t('relatedQ')}`,
                    h('span', { className: 'pa-label' },
                      `${t('scoreRate')} ${Math.round((selNode.rate || 0) * 100)}%（${selNode.score}/${selNode.full}） · ${t('historyWrong')} ${selNode.wrong}`),
                  ),
                  detail.length === 0
                    ? h('div', { className: 'pa-empty' }, t('legendNone'))
                    : h('table', { className: 'pa-table' },
                        h('thead', null, h('tr', null,
                          h('th', null, t('paperCol')),
                          h('th', null, t('no')),
                          h('th', null, t('type')),
                          h('th', null, t('scoreRatio')),
                          h('th', null, t('lost')),
                          h('th', null, t('errorReason')),
                          h('th', null, t('viewImage')),
                        )),
                        h('tbody', null,
                          detail.map((q, i) =>
                            h('tr', { key: i },
                              h('td', null, h('span', { className: 'pa-label' }, q.paper)),
                              h('td', null, h('span', { className: 'pa-badge' + (q.lost > 0 ? ' pa-badge-lost' : '') }, q.no)),
                              h('td', null, q.type || '—'),
                              h('td', null, `${q.score} / ${q.fullScore}`),
                              h('td', null, q.lost > 0 ? h('span', { className: 'pa-rate pa-rate-low' }, '−' + q.lost) : h('span', { className: 'pa-label' }, '—')),
                              h('td', null, q.errorCategory ? `${q.errorCategory}${q.errorReason ? ' · ' + q.errorReason : ''}` : h('span', { className: 'pa-label' }, '—')),
                              h('td', null, q.image
                                ? h('button', { className: 'pa-link', onClick: () => setViewImg({ src: q.image, title: `${q.paper} · ${t('no')} ${q.no}` }) }, t('viewImage'))
                                : null),
                            ),
                          ),
                        ),
                      ),
                ) : null,
                h(ImageModal, { image: viewImg && viewImg.src, title: viewImg && viewImg.title, onClose: () => setViewImg(null) }),
              ),
      );
    }

    /** 知识点输入框：可过滤、可滚动的自定义下拉（替代原生 datalist，列表长时也能方便选择）。 */
    function KpInput(props) {
      const [open, setOpen] = useState(false);
      const wrapRef = useRef(null);
      const value = props.value || '';
      const opts = props.options || [];
      const q = value.trim();
      const filtered = (q ? opts.filter((o) => o.includes(q)) : opts).slice(0, 100);
      useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
          if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
      }, [open]);
      return h('div', { className: 'pa-kp-wrap', ref: wrapRef },
        h('input', {
          className: 'pa-input',
          value,
          placeholder: props.placeholder || '',
          onFocus: () => setOpen(true),
          onChange: (e) => { props.onChange(e.target.value); setOpen(true); },
        }),
        open && filtered.length
          ? h('div', { className: 'pa-kp-drop' },
              filtered.map((o) =>
                h('div', {
                  key: o,
                  className: 'pa-kp-opt' + (o === value ? ' pa-kp-opt-sel' : ''),
                  title: o,
                  onMouseDown: (e) => { e.preventDefault(); props.onChange(o); setOpen(false); },
                }, o),
              ),
            )
          : null,
      );
    }

    /** 试卷分析表单：草稿与历史记录详情共用。data 为分析对象，update(mutator) 修改并自动保存。 */
    function AnalysisForm(props) {
      const data = props.data;
      const update = props.update;
      const [viewImg, setViewImg] = useState(null);
      const [kgTopics, setKgTopics] = useState([]);
      const questions = data.questions || [];

      // 当前科目的标准知识点清单（来自 K12 知识图谱），用于知识点输入框自动补全。
      useEffect(() => {
        const subject = data.subject;
        if (!subject) { setKgTopics([]); return; }
        let alive = true;
        fetch('/paper-analysis/kg?subject=' + encodeURIComponent(subject), { cache: 'no-store' })
          .then((r) => r.json())
          .then((j) => { if (alive) setKgTopics(j.topics || []); })
          .catch(() => { if (alive) setKgTopics([]); });
        return () => { alive = false; };
      }, [data.subject]);
      const setField = (key, value) => update((d) => { d[key] = value; return d; });
      const setQuestion = (i, key, value) => update((d) => { d.questions[i][key] = value; return d; });
      const setReason = (i, category, reason) => update((d) => {
        d.questions[i].errorCategory = category;
        d.questions[i].errorReason = reason;
        return d;
      });

      const stats = typeStatsOf(questions);
      const totalFull = stats.reduce((s, x) => s + x.fullScore, 0);
      const totalScore = stats.reduce((s, x) => s + x.score, 0);
      const wrongIdx = questions.map((q, i) => ({ q, i })).filter(({ q }) => lostOf(q) > 0);

      return h(React.Fragment, null,
        h('div', { className: 'pa-card' },
          h('div', { className: 'pa-card-title' }, t('paper')),
          h('div', { className: 'pa-grid' },
            h(Field, { label: t('paperTitle'), value: data.title, placeholder: t('paperTitlePh'), onChange: (v) => setField('title', v) }),
            h(Field, { label: t('subject'), value: data.subject, onChange: (v) => setField('subject', v) }),
            h(SelectField, { label: t('examType'), options: EXAM_TYPES, value: data.examType, onChange: (v) => setField('examType', v) }),
            h(Field, { label: t('examDate'), type: 'date', value: data.date, onChange: (v) => setField('date', v) }),
            h(Field, { label: t('score'), value: data.score, onChange: (v) => setField('score', v) }),
            h(Field, { label: t('totalScore'), value: data.totalScore, onChange: (v) => setField('totalScore', v) }),
          ),
        ),

        stats.length ? h('div', { className: 'pa-card' },
          h('div', { className: 'pa-card-title' },
            t('typeStats'),
            h('span', { className: 'pa-label' },
              t('overallRate') + '：' + (totalFull > 0 ? pct(totalScore / totalFull) + `（${totalScore} / ${totalFull}）` : '—')),
          ),
          stats.map((x) =>
            h('div', { key: x.type, className: 'pa-bar-row' },
              h('div', { className: 'pa-bar-name', title: x.type }, `${x.type}（${x.count}）`),
              h('div', { className: 'pa-bar-track' },
                h('div', { className: 'pa-bar-fill' + (x.scoreRate < 0.6 ? ' pa-bar-fill-low' : ''), style: { width: pct(x.scoreRate) } }),
              ),
              h('div', { className: 'pa-bar-val' }, `${x.score} / ${x.fullScore} · ${pct(x.scoreRate)}`),
            ),
          ),
        ) : null,

        h('div', { className: 'pa-card' },
          h('div', { className: 'pa-card-title' },
            t('questions'),
            questions.length
              ? h('span', { className: 'pa-label' }, `${t('wrongList')} ${wrongIdx.length} / ${questions.length}`)
              : null,
          ),
          questions.length === 0
            ? h('div', { className: 'pa-empty' }, '…')
            : h('table', { className: 'pa-table' },
                h('thead', null, h('tr', null,
                  h('th', null, t('no')),
                  h('th', null, t('type')),
                  h('th', null, t('score')),
                  h('th', null, t('totalScore')),
                  h('th', null, t('lost')),
                  h('th', null, t('kpName')),
                  h('th', null, t('errorReason')),
                  h('th', null, t('note')),
                  h('th', null, t('viewImage')),
                  h('th', null, ''),
                )),
                h('tbody', null,
                  questions.map((q, i) => {
                    const lost = lostOf(q);
                    return h('tr', { key: i },
                      h('td', null, h('input', { className: 'pa-input pa-num', value: q.no, onChange: (e) => setQuestion(i, 'no', e.target.value) })),
                      h('td', null, h('input', { className: 'pa-input', value: q.type, onChange: (e) => setQuestion(i, 'type', e.target.value) })),
                      h('td', null, h('input', { className: 'pa-input pa-num', value: q.score, onChange: (e) => setQuestion(i, 'score', e.target.value) })),
                      h('td', null, h('input', { className: 'pa-input pa-num', value: q.fullScore, onChange: (e) => setQuestion(i, 'fullScore', e.target.value) })),
                      h('td', null, lost > 0
                        ? h('span', { className: 'pa-rate pa-rate-low' }, '−' + lost)
                        : h('span', { className: 'pa-label' }, '—')),
                      h('td', null,
                        h(KpInput, { value: q.knowledgePoint, options: kgTopics, placeholder: t('kpPh'), onChange: (v) => setQuestion(i, 'knowledgePoint', v) }),
                        lost > 0 && !q.knowledgePoint ? h('div', { className: 'pa-warn' }, t('wrongNeedKp')) : null,
                      ),
                      h('td', null, lost > 0
                        ? h(ReasonPicker, {
                            category: q.errorCategory,
                            reason: q.errorReason,
                            onChange: (cat, reason) => setReason(i, cat, reason),
                          })
                        : null),
                      h('td', null, h('input', { className: 'pa-input', value: q.note, placeholder: t('notePh'), onChange: (e) => setQuestion(i, 'note', e.target.value) })),
                      h('td', null, q.image
                        ? h('button', { className: 'pa-link', onClick: () => setViewImg({ src: q.image, title: `${t('no')} ${q.no || i + 1}` }) }, t('viewImage'))
                        : null),
                      h('td', null, h('button', {
                        className: 'pa-link pa-link-danger pa-del',
                        onClick: () => update((d) => { d.questions.splice(i, 1); return d; }),
                      }, t('deleteRow'))),
                    );
                  }),
                ),
              ),
          h('div', { className: 'pa-row-actions' },
            h('button', {
              className: 'pa-btn',
              onClick: () => update((d) => {
                d.questions.push({ no: String(d.questions.length + 1), type: '', score: '', fullScore: '', knowledgePoint: '', errorCategory: '', errorReason: '', note: '' });
                return d;
              }),
            }, t('addQuestion')),
          ),
          h(TaxonomyRef),
        ),

        h('div', { className: 'pa-card' },
          h('div', { className: 'pa-card-title' }, t('reviewPlan')),
          h('textarea', {
            className: 'pa-input',
            value: data.reviewPlan,
            onChange: (e) => setField('reviewPlan', e.target.value),
          }),
        ),

        h(ImageModal, { image: viewImg && viewImg.src, title: viewImg && viewImg.title, onClose: () => setViewImg(null) }),
      );
    }

    /** 错误原因参考表（说明文字来自模板）。 */
    function TaxonomyRef() {
      return h('details', { className: 'pa-ref', style: { marginTop: '10px' } },
        h('summary', null, t('taxonomyRef')),
        ERROR_TAXONOMY.map((c) =>
          h('div', { key: c.key },
            h('div', { className: 'pa-ref-cat' }, `${c.key} `, h('span', { className: 'pa-ref-tag' }, `（${c.tag}）`)),
            c.reasons.map(([name, desc]) =>
              h('div', { key: name, className: 'pa-ref-item' }, h('b', null, name), `：${desc}`),
            ),
          ),
        ),
      );
    }

    /** 创建一个防抖自动保存器：update(mutator) 修改数据并在 700ms 后 POST。 */
    function makeAutoSaver(setData, postFn) {
      const dirtyRef = { current: false };
      const timerRef = { current: null };
      const update = (mutator) => {
        setData((prev) => {
          if (!prev) return prev;
          const next = mutator(JSON.parse(JSON.stringify(prev)));
          dirtyRef.current = true;
          if (timerRef.current) clearTimeout(timerRef.current);
          const snapshot = next;
          timerRef.current = setTimeout(async () => {
            try {
              const json = await postFn(snapshot);
              if (json && json.ok) dirtyRef.current = false;
            } catch { /* stays dirty; next edit retries */ }
          }, 700);
          return next;
        });
      };
      return { update, dirtyRef };
    }

    function Panel() {
      const [view, setView] = useState('draft'); // 'draft' | 'history' | 'record'
      const [data, setData] = useState(null); // 草稿
      const [scan, setScan] = useState(null);
      const [records, setRecords] = useState(null); // 历史列表
      const [record, setRecord] = useState(null); // 正在查看/编辑的历史记录
      const [starting, setStarting] = useState(false);
      const [saving, setSaving] = useState(false);
      const [failed, setFailed] = useState(false);
      const [notice, setNotice] = useState('');
      const fileRef = useRef(null);

      const draftSaverRef = useRef(null);
      if (!draftSaverRef.current) {
        draftSaverRef.current = makeAutoSaver(setData, async (snapshot) => {
          const res = await fetch('/paper-analysis/state.json', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(snapshot),
          });
          const json = await res.json();
          if (json.ok && json.draft) setData((prev) => (JSON.stringify(prev) === JSON.stringify(snapshot) ? json.draft : prev));
          return json;
        });
      }
      const draftUpdate = draftSaverRef.current.update;
      const draftDirty = draftSaverRef.current.dirtyRef;

      const recordSaverRef = useRef(null);
      if (!recordSaverRef.current) {
        recordSaverRef.current = makeAutoSaver(setRecord, async (snapshot) => {
          if (!snapshot || !snapshot.id) return { ok: false };
          const res = await fetch('/paper-analysis/record.json?id=' + encodeURIComponent(snapshot.id), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(snapshot),
          });
          return res.json();
        });
      }
      const recordUpdate = recordSaverRef.current.update;

      const load = useCallback(async () => {
        try {
          const res = await fetch('/paper-analysis/state.json', { cache: 'no-store' });
          if (!res.ok) throw new Error('http ' + res.status);
          const json = await res.json();
          if (!draftDirty.current && json.draft) setData(json.draft);
          setScan(json.scan || null);
          setFailed(false);
        } catch {
          setFailed(true);
        }
      }, []);

      useEffect(() => {
        load();
        const timer = setInterval(() => {
          setView((v) => {
            if (v === 'draft') load();
            return v;
          });
        }, 3000);
        return () => clearInterval(timer);
      }, [load]);

      const loadRecords = useCallback(async () => {
        try {
          const res = await fetch('/paper-analysis/records', { cache: 'no-store' });
          const json = await res.json();
          setRecords(json.records || []);
        } catch {
          setRecords([]);
        }
      }, []);

      const openHistory = () => {
        setView('history');
        setRecord(null);
        loadRecords();
      };

      const openRecord = async (id) => {
        try {
          const res = await fetch('/paper-analysis/record.json?id=' + encodeURIComponent(id), { cache: 'no-store' });
          const json = await res.json();
          if (json.record) {
            setRecord(json.record);
            setView('record');
            setNotice(t('recordEditing'));
          }
        } catch { /* ignore */ }
      };

      const deleteRecord = async (id) => {
        if (!window.confirm(t('historyDeleteConfirm'))) return;
        try {
          await fetch('/paper-analysis/record/delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          if (view === 'record') setView('history');
          setRecord(null);
          loadRecords();
        } catch { /* ignore */ }
      };

      const fileToBase64 = (file) => new Promise((resolvePromise, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolvePromise(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const onUpload = async (files) => {
        for (const file of files) {
          try {
            const dataBase64 = await fileToBase64(file);
            const res = await fetch('/paper-analysis/scan', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name: file.name, dataBase64 }),
            });
            const json = await res.json();
            if (json.scan) setScan(json.scan);
            if (json.ok && json.notified) setNotice(t('scanNotified'));
            else if (json.ok && json.pdf && json.converted === false) setNotice(t('scanPdfNoConvert') + json.path);
            else if (json.ok) setNotice(t('scanSaved') + json.path);
            else setNotice(t('scanFailed') + (json.error || ''));
          } catch (err) {
            setNotice(t('scanFailed') + String((err && err.message) || err));
          }
        }
        if (fileRef.current) fileRef.current.value = '';
      };

      const onStartAnalysis = async () => {
        setStarting(true);
        try {
          const res = await fetch('/paper-analysis/scan/start', { method: 'POST' });
          const json = await res.json();
          if (json.scan) setScan(json.scan);
          if (!json.ok) setNotice(t('scanFailed') + (json.error || ''));
          else if (!json.notified) setNotice(t('startNoSession'));
          else setNotice(t('scanNotified'));
        } catch (err) {
          setNotice(t('scanFailed') + String((err && err.message) || err));
        } finally {
          setStarting(false);
        }
      };

      const onDismissScan = async () => {
        setScan(null);
        try {
          await fetch('/paper-analysis/scan/dismiss', { method: 'POST' });
        } catch { /* ignore */ }
      };

      const onSaveRecord = async () => {
        if (!data) return;
        setSaving(true);
        try {
          const res = await fetch('/paper-analysis/records/save', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ draft: data }),
          });
          const json = await res.json();
          if (json.ok) setNotice(t('savedOk') + (json.record && json.record.title ? `「${json.record.title}」` : ''));
          else setNotice(t('saveFailed'));
        } catch {
          setNotice(t('saveFailed'));
        } finally {
          setSaving(false);
        }
      };

      const onClear = () => {
        if (!window.confirm(t('clearConfirm'))) return;
        draftUpdate(() => ({
          title: '', subject: '', examType: '', date: '', score: '', totalScore: '',
          questions: [], reviewPlan: '', updatedAt: null,
        }));
        setNotice(t('clearDone'));
      };

      if (!data) {
        return h('div', { className: 'pa-page' },
          h('style', null, CSS),
          h('div', { className: 'pa-wrap' },
            h('div', { className: 'pa-head' }, h('div', { className: 'pa-title' }, t('title'))),
            h('div', { className: 'pa-card' }, h('div', { className: 'pa-empty' }, failed ? t('loadFailed') : '…')),
          ),
        );
      }

      // ---- 学情看板视图 ----
      if (view === 'dashboard') {
        return h('div', { className: 'pa-page' },
          h('style', null, CSS),
          h('div', { className: 'pa-wrap' }, h(Dashboard, { onBack: () => setView('draft') })),
        );
      }

      // ---- 历史列表视图 ----
      if (view === 'history') {
        return h('div', { className: 'pa-page' },
          h('style', null, CSS),
          h('div', { className: 'pa-wrap' },
            h('div', { className: 'pa-head' },
              h('div', { className: 'pa-title' }, t('title') + ' · ' + t('history')),
              h('button', { className: 'pa-btn', onClick: () => setView('draft') }, t('backToDraft')),
              h('button', { className: 'pa-btn', onClick: loadRecords }, t('refresh')),
            ),
            h('div', { className: 'pa-card' },
              !records
                ? h('div', { className: 'pa-empty' }, '…')
                : records.length === 0
                  ? h('div', { className: 'pa-empty' }, t('historyEmpty'))
                  : h('table', { className: 'pa-table' },
                      h('thead', null, h('tr', null,
                        h('th', null, t('historyTitleCol')),
                        h('th', null, t('subject')),
                        h('th', null, t('examType')),
                        h('th', null, t('scoreRatio')),
                        h('th', null, t('scoreRate')),
                        h('th', null, t('historyWrong')),
                        h('th', null, t('historySavedAt')),
                        h('th', null, ''),
                      )),
                      h('tbody', null,
                        records.map((r) =>
                          h('tr', { key: r.id },
                            h('td', null,
                              h('div', { className: 'pa-hist-title' }, r.title || t('untitled')),
                              r.date ? h('div', { className: 'pa-hist-sub' }, r.date) : null,
                            ),
                            h('td', null, r.subject || '—'),
                            h('td', null, r.examType || '—'),
                            h('td', null, `${r.score || '?'} / ${r.totalScore || '?'}`),
                            h('td', null, h('span', { className: 'pa-rate' + (r.scoreRate < 0.6 ? ' pa-rate-low' : '') }, pct(r.scoreRate || 0))),
                            h('td', null, String(r.wrongCount)),
                            h('td', null, h('span', { className: 'pa-label' }, fmtTime(r.updatedAt))),
                            h('td', null,
                              h('button', { className: 'pa-link', onClick: () => openRecord(r.id) }, t('historyOpen')),
                              ' ',
                              h('button', { className: 'pa-link pa-link-danger', onClick: () => deleteRecord(r.id) }, t('historyDelete')),
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
          ),
        );
      }

      // ---- 历史记录详情视图（直接编辑并覆盖保存）----
      if (view === 'record' && record) {
        return h('div', { className: 'pa-page' },
          h('style', null, CSS),
          h('div', { className: 'pa-wrap' },
            h('div', { className: 'pa-head' },
              h('div', { className: 'pa-title' }, record.title || t('untitled')),
              h('button', { className: 'pa-btn', onClick: openHistory }, t('backToHistory')),
              h('button', { className: 'pa-btn pa-btn-danger', onClick: () => deleteRecord(record.id) }, t('historyDelete')),
            ),
            notice ? h('div', { className: 'pa-notice' }, notice) : null,
            h(AnalysisForm, { data: record, update: recordUpdate }),
            h('div', { className: 'pa-foot' },
              h('span', null, t('recordEditing')),
              h('span', null, record.updatedAt ? t('updated') + ' ' + fmtTime(record.updatedAt) : ''),
            ),
          ),
        );
      }

      // ---- 当前分析（草稿）视图 ----
      const isEmpty = (data.questions || []).length === 0 && !data.title && !data.subject;
      return h('div', { className: 'pa-page' },
        h('style', null, CSS),
        h('div', { className: 'pa-wrap' },
          h('div', { className: 'pa-head' },
            h('div', { className: 'pa-title' }, t('title')),
            h('input', {
              ref: fileRef, type: 'file', accept: 'image/*,.pdf', multiple: true,
              style: { display: 'none' },
              onChange: (e) => onUpload(Array.from(e.target.files || [])),
            }),
            h('button', { className: 'pa-btn', onClick: () => fileRef.current && fileRef.current.click() }, t('upload')),
            h('button', { className: 'pa-btn pa-btn-primary', disabled: saving, onClick: onSaveRecord }, saving ? t('saving') : t('saveRecord')),
            h('button', { className: 'pa-btn', onClick: openHistory }, t('history')),
            h('button', { className: 'pa-btn', onClick: () => setView('dashboard') }, t('kpDashboard')),
            h('button', { className: 'pa-btn pa-btn-danger', onClick: onClear }, t('clear')),
            h('button', { className: 'pa-btn', onClick: load }, t('refresh')),
          ),
          notice ? h('div', { className: 'pa-notice' }, notice) : null,
          failed ? h('div', { className: 'pa-notice' }, t('loadFailed')) : null,

          scan ? h(ScanCard, { scan, starting, onStart: onStartAnalysis, onDismiss: onDismissScan }) : null,

          isEmpty ? h('div', { className: 'pa-card' },
            h('div', { className: 'pa-card-title' }, t('emptyTitle')),
            h('div', { className: 'pa-empty' },
              h('ol', null,
                h('li', null, t('emptyStep1')),
                h('li', null, t('emptyStep2')),
                h('li', null, t('emptyStep3')),
              ),
            ),
          ) : null,

          h(AnalysisForm, { data, update: draftUpdate }),

          h('div', { className: 'pa-foot' },
            h('span', null, ''),
            h('span', null, data.updatedAt ? t('updated') + ' ' + fmtTime(data.updatedAt) : ''),
          ),
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined;
        if (locale) {
          try {
            ctx.effect(() => {
              const offZh = locale.register('paper-analysis', 'zh', ZH);
              const offEn = locale.register('paper-analysis', 'en', EN);
              return () => { offZh(); offEn(); };
            });
            const bound = locale.bind('paper-analysis');
            translate = (key) => {
              try {
                const value = bound(key);
                return typeof value === 'string' && value ? value : (ZH[key] || key);
              } catch {
                return ZH[key] || key;
              }
            };
          } catch { /* keep Chinese defaults */ }
        }
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'paper-analysis',
            order: 20,
            label: () => t('title'),
          }, Icon),
        );
        ctx.slots.inject('main', () =>
          ctx.slots.register({
            name: 'main',
            key: 'paper-analysis',
            label: () => t('title'),
          }, Panel),
        );
      },
    };
  },
});
