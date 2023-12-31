// Node.js内蔵のファイルパス関連モジュールを読み込み
const path = require('path');

// Expressサーバーパッケージを読み込み
const express = require("express");


//  パスワードハッシュ化パッケージを読み込み
const bcrypt = require('bcryptjs');

// ランダム文字列生成パッケージを読み込み
const cryptoRandomString = require('crypto-random-string');

// 同じフォルダにあるfunctions.jsを読み込み
const func = require("./functions");

// Expressサーバー使用準備
const app = express();

// 静的ファイル配信設定(/style.cssなど)
app.use(express.static("public"));

// テンプレートエンジン設定
app.set("view engine", "ejs");

// テンプレート内で使用する関数の登録
app.locals.convertDateFormat = func.convertDateFormat;

// POSTリクエストのパラメータを取得するための設定
app.use(express.urlencoded({ extended: true}));

// ブラウザから送信されたきたクッキーを取得するための設定
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// アップロードされたファイルを取得するための設定
const fileUpload = require('express-fileupload');
const { fdatasync } = require('fs');
app.use(fileUpload());

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
  // const entry = func.fileNameToEntry(request.params.date + ".txt", false);
  const { date } = request.params;
  const entry = func.fileNameToEntry(date + '.txt', false);
  const commentList = func.getCommentList(date);
  response.render("entry", {
    entry,
    commentList,
    sideList,
  });
});

app.post('/blog/:date/post_comment', (request, response) => {
  const { date } = request.params;
  const { comment } = request.body;
  if (comment) {
    func.saveComment(date, comment);
  }
  response.redirect('/blog/' + date);
});

app.get('/login/', (request, response) => {
  response.render('login', {
    message: (request.query.failed)? 'ログインできませんでした。': ''
  });
});

// let sessionId = null;
app.post('/auth', (request, response) => {
  // if (request.body.password === 'password'){
  const hashed = func.loadPassword();
  if (hashed && bcrypt.compareSync(request.body.password, hashed)){
    // response.cookie('session', 'login_ok');
    const sessionId = cryptoRandomString({
      length: 100
    });
    func.saveSessionId(sessionId);
    response.cookie('session', sessionId, {
      httpOnly: true,
    });
    response.redirect('/admin/');
  }else {
    response.redirect('/login/?failed=1');
  }
});

app.get('/logout', (request, response) => {
  // sessionId = null;
  func.deleteSessionId();
  response.redirect('/login/');
});

app.use('/admin/', (request, response, next) => {
  // デバッグ用コンソール
  // console.log(request.cookies.session);

  const sessionId = func.loadSessionId();

  // Cookieのsessionの値が'login_ok'でなければログイン画面に戻す
  // if (request.cookies.session === 'login_ok') {
    if(sessionId && request.cookies.session === sessionId ){
    next();
  } else {
    response.redirect('/login');
    console.log('ログイン画面です');
  }
});

app.get('/admin/', (request, response) => {
  // ブログ記事ファイル一覧取得
  const files = func.getEntryFiles();
  // メインコンテンツに表示するブログ記事
  const entries = func.getEntries(files);

  response.render('admin', {
    entries,
    hasTodayEntry: files.indexOf(func.getDateString() + '.txt') !== -1,
  });

})

app.get('/admin/edit', (request, response) => {

  // 新規登録の場合は記事投稿ページの内容は全て空にする(dateは自動設定)
  let entry = {
    date: func.getDateString(),
    title: '',
    content: '',
    image: null,
    };

  let pageTitle = '記事の新規投稿'
  let commentList = null;

    // dateパラメータありの場合は記事の編集なので該当の記事データを取得してセットする
    if(request.query.date){
      entry = func.fileNameToEntry(request.query.date + '.txt', false);
      pageTitle = '記事の編集(' + func.convertDateFormat(entry.date) + ')';
      commentList = func.getCommentList(entry.date);
    }

    response.render('edit', {
      entry,
      pageTitle,
      commentList,
    });
})

app.post('/admin/post_entry', (request, response) => {
  const { date, title, content, imgdel } = request.body;
  func.saveEntry(date, title, content, imgdel);
  // ファイルがアップロードされているかチェック
  if(!request.files){
    response.redirect('/admin/');
    return;
  }



  // アップロードされたファイルが画像かチェック
  const {image} = request.files;
  if(!image.mimetype.startsWith('image/')){
    response.redirect('/admin/');
    return;
  }

  // 既存のアップロードファイルを削除
  func.deleteImage(date);

  // アップロードされたファイルを保存
  const saveDir = func.createImageDir(date);
  image.mv(path.join(saveDir, image.name), (err) =>{
    if(err){
      console.log(err);
    }
    response.redirect('/admin/');
  } );
})

app.post('/admin/delete_entry', (request, response) => {
  func.deleteEntry(request.body.date);
  response.redirect('/admin/');
})


app.post('/admin/change_password', (request, response) => {
  const { password, password_verify } = request.body;
  if (password.length < 8) {
    response.send('パスワードは8文字以上にしてください。');
    return;
  }
  if (password !== password_verify){
    response.send('確認用のパスワードが異なります。');
    return;
  }
  const hashed = bcrypt.hashSync(password);
  func.savePassword(hashed);
  response.send('パスワードの変更ができました。');
});

app.post('/admin/delete_comment', (request, response) => {
  const { date, id} = request.body;
  console.log(date, id);
  func.deleteComment(date, id);
  response.redirect('/admin/edit?date=' + date);
});

// Expressサーバー起動
const server = app.listen(15864, () => {
  console.log("Listening on http://127.0.0.1:" + server.address().port + "/");
});


// Expressで処理される前の通信生データを表示
// server.on('connection', (socket) => {
//   socket.on('data', (data) => {
//     console.log(data.toString());
//   })
// })
