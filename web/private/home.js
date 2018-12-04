(async function main() {
  // クエストリストを取得
  const questList = await fetch('/quest/list').then((res) => res.json());

  // クエストごとにボタン作成
  for(const quest of questList) {
    const button = document.createElement('button');
    button.innerText = quest.title;
    button.addEventListener('click', async (event) => {
      // /quest/startにクエストIDをPOSTしてルームIDを受け取る
      const { roomId } = await fetch('/quest/start', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        method: 'POST',
        credentials: 'include',
        body: `{ "questId": "${quest._id}" }`
      }).then((res) => res.json());

      // バトル画面に移動する
      location.href = `battle.html?room=${roomId}`;
    });
    document.body.appendChild(button);
  }
})();