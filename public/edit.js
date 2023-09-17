const forms = document.querySelectorAll('form');

const confirmMessages = {
  edit: '記事を更新します。',
  comment: '選択したコメントを削除します。'
};

forms.forEach((form) => {
  form.addEventListener('submit', (ev) => {
    const message = confirmMessages[form.name];
    if(!confirm(message + 'よろしいでしょうか？')){
      ev.preventDefault();
    }
  });
});
