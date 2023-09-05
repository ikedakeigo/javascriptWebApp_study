// Expressサーバーパッケージを読み込み
const express = require("express");
// 同じフォルダにあるfunctions.jsを読み込み
const func = require("./functions");

// Expressサーバー使用準備
const app = express();

// 静的ファイル配信設定(/style.cssなど)
app.use(express.static("public"));

// テンプレートエンジン設定
app.set("view engine", "ejs");

// ルーティング設定
app.get("/blog/", (request, response) => {

  // ブログ記事ファイル一覧取得
  const files = func.getEntryFiles();
  // メインコンテンツに表示するブログ記事
  const entries = func.getEntries(files);
  // サイドバーに表示する年月別記事リスト
  const sideList = func.getSideList(entries);

  // ページに応じた記事一覧に絞る(1ページ5件)
  // const startIndex = (request.query.page - 1) * 5;
  const entriesPerPage = 5;
  const currentPage = parseInt(request.query.page|| 1, 10);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const displayEntries = entries.slice(startIndex, endIndex);
  const lastPage = Math.ceil(entries.length / entriesPerPage);

  console.log({
    currentPage,
    startIndex,
    endIndex,
    displayEntries,
  })

  // テンプレートを使用して出力したHTMLをクライアントに送信
  response.render("blog", {
    entries: displayEntries,
    sideList,
    // currentPage: parseInt(request.query.page, 10)
    currentPage,
    lastPage,
  });
});

app.get("/blog/:date", (request, response) => {
  // ブログ記事ファイル一覧取得
  const files = func.getEntryFiles();
  // メインコンテンツに表示するブログ記事
  const entries = func.getEntries(files);
  // サイドバーに表示する年月別記事リスト
  const sideList = func.getSideList(entries);

  // ブログ記事を取得してテンプレートに渡して出力したHTMLをクライアントに送信
  const entry = func.fileNameToEntry(request.params.date + ".txt", false);
  response.render("entry", {
    entry,
    sideList,
  });
});

app.get('/admin/edit', (request, response) => {
  response.render('edit');
})

// Expressサーバー起動
const server = app.listen(15864, () => {
  console.log("Listening on http://127.0.0.1:" + server.address().port + "/");
});