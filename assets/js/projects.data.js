/* Portfolio projects list — single source of truth for which repos appear on the site.
   Edited by the local admin tool (`bun admin/server.js`) or by hand.
   Array body must stay valid JSON: projects.js and the admin server both parse it. */
window.PORTFOLIO_PROJECTS = [
  {"repo":"LCC_Review_Sentiment_Cluster","report":"report.html","featured":true,"highlight":"Prioritized high-intensity, low-cost airline complaint fixes.","categories":["data-analysis","ml-nlp","visualization"],"preview":{"kind":"chart","src":"assets/img/projects/lcc-review.webp","alt":"Airline review sentiment clusters and complaint priorities"}},
  {"repo":"steam-review","report":"index.html","featured":true,"highlight":"Separated loud complaints from complaints that actually drive churn.","categories":["data-analysis","ml-nlp"],"preview":{"kind":"chart","src":"assets/img/projects/steam-review.webp","alt":"Steam review complaint impact and churn analysis"}},
  {"repo":"deeptool","report":"en","featured":true,"categories":["developer-tools","ml-nlp"],"preview":{"kind":"workflow"}},
  {"repo":"book-review-rank-predict","report":"report.html","featured":false,"highlight":"Tested whether book copy predicts sales across 1,814 titles.","categories":["data-analysis","ml-nlp","visualization"],"preview":{"kind":"chart","src":"assets/img/projects/book-review.webp","alt":"Book sales rank analysis across 1,814 titles"}},
  {"repo":"seoul-bike-analysis","report":"report.html","featured":false,"highlight":"Mapped station-level demand and supply gaps across Seoul.","categories":["data-analysis","visualization"],"preview":{"kind":"chart","src":"assets/img/projects/seoul-bike.webp","alt":"Seoul bike station demand and supply map"}},
  {"repo":"data-analysis-project","featured":false,"highlight":"Built a gated nine-stage data-analysis workflow.","categories":["data-analysis","developer-tools"],"preview":{"kind":"workflow"}},
  {"repo":"pybacktest","featured":false,"highlight":"Turned strategy backtests into an interactive workflow.","categories":["data-analysis","developer-tools","apps","visualization"],"preview":{"kind":"chart","src":"assets/img/projects/pybacktest.webp","alt":"Pybacktest Portfolio Value Over Time chart"}},
  {"repo":"fashion_mnist","featured":false,"categories":["data-analysis","ml-nlp","visualization"],"preview":{"kind":"workflow"}},
  {"repo":"pyile_manager","featured":false,"highlight":"Explored local-AI file renaming in a native desktop workflow.","categories":["developer-tools","apps"],"preview":{"kind":"app"}},
  {"repo":"routine-timer","featured":false,"highlight":"Designed a focused macOS timer with long-term routine feedback.","categories":["apps","visualization"],"preview":{"kind":"app"}},
  {"repo":"whisper-transcribe","featured":false,"highlight":"Made local audio transcription repeatable from the command line.","categories":["ml-nlp","developer-tools"],"preview":{"kind":"terminal"}}
];
