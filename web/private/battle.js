// URLからルームIDを取得する
const params = new URLSearchParams(location.href.split('?')[1]);
const roomId = params.get('room');

// 敵データを描画する関数
function renderEnemyDataList(enemyDataList) {
  const enemyInfo = document.querySelector('.enemy-info');
  const enemyStage = document.querySelector('.stage-enemyside');

  // 内容を一旦削除
  enemyInfo.innerHTML = '';
  enemyStage.innerHTML = '';

  // 敵ごとにHPバー、CT、ODゲージを表示
  for(const enemy of enemyDataList) {
    const enemyHpPercentage = document.createElement('div');
    enemyHpPercentage.innerText = Math.ceil(enemy.hp * 100).toString() + '%';

    // バフ・デバフ
    enemy.status.forEach((status) => {
      const statusElement = document.createElement('span');
      statusElement.innerText = status.icon;
      enemyHpPercentage.appendChild(statusElement);
    });

    // HPバー
    const enemyHpBar = document.createElement('meter');
    enemyHpBar.classList.add('enemy-hp-bar');
    enemyHpBar.min = 0;
    enemyHpBar.max = 1;
    enemyHpBar.value = enemy.hp;

    const enemyCtAndOverdriveContainer = document.createElement('div');
    enemyCtAndOverdriveContainer.classList.add('enemy-ct-and-overdrive-container');

    // CT
    const enemyCt = document.createElement('div');
    enemyCt.innerText = 'CT' + new Array(enemy.currentCt).fill('◆').join('').padEnd(enemy.maxCt, '◇');
    enemyCtAndOverdriveContainer.appendChild(enemyCt);

    // ODゲージ
    const enemyModeGaugeContainer = document.createElement('div');
    const enemyModeGaugeLabel = new Text('Mode');
    const enemyModeGauge = document.createElement('meter');
    enemyModeGauge.classList.add('enemy-mode-gauge');
    enemyModeGauge.min = 0;
    enemyModeGauge.max = 1;
    enemyModeGauge.value = enemy.currentModeGauge;
    enemyModeGaugeContainer.appendChild(enemyModeGaugeLabel);
    enemyModeGaugeContainer.appendChild(enemyModeGauge);
    enemyCtAndOverdriveContainer.appendChild(enemyModeGaugeContainer);

    enemyInfo.appendChild(enemyHpPercentage);
    enemyInfo.appendChild(enemyHpBar);
    enemyInfo.appendChild(enemyCtAndOverdriveContainer);

    // グラフィック表示
    const enemyGraphic = document.createElement('div');
    enemyGraphic.innerText = enemy.graphic;
    enemyGraphic.classList.add('enemy-graphic');
    const enemyName = document.createElement('div');
    enemyName.innerText = enemy.name;

    enemyStage.appendChild(enemyGraphic);
    enemyStage.appendChild(enemyName);
  }
}

// プレイヤーのパーティを描画する関数
function renderPlayerParty(party, websocket, user) {
  const playerStage = document.querySelector('.stage-playerside');
  const controlContainer = document.querySelector('.control-container');

  // 内容を一旦削除
  playerStage.innerHTML = '';
  controlContainer.innerHTML = '';

  party.members.forEach((character, index) => {
    const characterGraphic = document.createElement('div');
    characterGraphic.innerText = character.graphic;
    characterGraphic.classList.add('character-graphic');
    playerStage.appendChild(characterGraphic);

    const characterControl = document.createElement('div');

    // キャラ名表示
    const characterName = document.createElement('div');
    characterName.innerText = character.graphic + character.name;
    characterControl.appendChild(characterName);

    // HPバー表示。バフ・デバフもここに表示
    const characterHp = document.createElement('div');
    const characterHPText = document.createElement('span');
    characterHPText.innerText = character.currentHp.toString();
    const characterHpBar = document.createElement('meter');
    characterHpBar.min = 0;
    characterHpBar.max = character.hp;
    characterHpBar.value = character.currentHp;
    characterHp.appendChild(characterHPText);
    characterHp.appendChild(characterHpBar);

    // バフ・デバフ
    character.status.forEach((status) => {
      const statusElement = document.createElement('span');
      statusElement.innerText = status.icon;
      characterHp.appendChild(statusElement);
    });

    characterControl.appendChild(characterHp);

    // 奥義ゲージ
    const characterCharge = document.createElement('div');
    const characterChargeText = document.createElement('span');
    characterChargeText.innerText = character.charge + '%';
    const characterChargeBar = document.createElement('meter');
    characterChargeBar.min = 0;
    characterChargeBar.max = 100;
    characterChargeBar.value = character.charge;
    characterCharge.appendChild(characterChargeText);
    characterCharge.appendChild(characterChargeBar);
    characterControl.appendChild(characterCharge);

    // アビリティボタン
    const abilityRow = document.createElement('div');
    abilityRow.classList.add('ability-row');
    character.abilities.forEach((ability, abilityIndex) => {
      const abilityButton = document.createElement('button');
      abilityButton.classList.add('ability-button');
      abilityButton.classList.add(`ability-button-${ability.type}`);
      abilityButton.innerText = ability.icon + ability.name + (ability.recast > 0 ? `(${ability.recast})` : '');
      abilityButton.disabled = ability.recast > 0;
      abilityButton.onclick = (event) => {
        abilityButton.disabled = true;
        websocket.send(JSON.stringify({
          command: 'useability',
          payload: {
            playerId: user.id,
            room: roomId,
            characterIndex: index,
            abilityIndex,
            targetIndex: 0 // ターゲット選択対応してないから0番目固定
          }
        }));
      };
      abilityRow.appendChild(abilityButton);
    });

    characterControl.appendChild(abilityRow);

    controlContainer.appendChild(characterControl);
  });
}

async function playAnimation(animationList) {
  for(const animation of animationList) {
    // 与ダメージのアニメーション
    // ダメージ表示するこの方法かなりダサいし遅いので実際はもうちょっとどうにかしたほうがいい
    // とくにgetBoundingClientRectはヤバい
    if(animation.type === 'damage') {
      const target = document.querySelectorAll('.enemy-graphic')[animation.targetIndex];
      const targetRect = target.getBoundingClientRect();

      const damageIndicator = document.createElement('div');
      damageIndicator.classList.add('damage');
      damageIndicator.innerText = animation.damage;
      damageIndicator.style.left = targetRect.left + 'px';
      damageIndicator.style.top = targetRect.top + 50 + 'px';

      document.body.appendChild(damageIndicator);

      const hpBar = document.querySelectorAll('.enemy-hp-bar')[animation.targetIndex];
      hpBar.value = animation.enemyHp;

      const modeBar = document.querySelectorAll('.enemy-mode-gauge')[animation.targetIndex];
      modeBar.value = animation.enemyModeGauge;

      await new Promise((resolve, reject) => {
        setTimeout(()=> {
          document.body.removeChild(damageIndicator);
          resolve();
        },500);
      });
    }

    // 被ダメージのアニメーション
    if(animation.type === 'receiveddamage') {
      const target = document.querySelectorAll('.character-graphic')[animation.targetIndex];
      const targetRect = target.getBoundingClientRect();

      const damageIndicator = document.createElement('div');
      damageIndicator.classList.add('damage');
      damageIndicator.innerText = animation.damage;
      damageIndicator.style.left = targetRect.left + 'px';
      damageIndicator.style.top = targetRect.top + 50 + 'px';

      document.body.appendChild(damageIndicator);

      await new Promise((resolve, reject) => {
        setTimeout(()=> {
          document.body.removeChild(damageIndicator);
          resolve();
        },500);
      });
    }
  }
}

// 自分のID取得する
fetch('/user/authenticated')
  .then((res) => res.json())
  .then(async (user) => {
    const attackButton = document.querySelector('.attack-button');

    // WebSocketでサーバに接続する
    const ws = new WebSocket('ws://localhost:4000/');

    // 接続がオープンしたらjoinコマンドを送る
    ws.addEventListener('open', (event) => {
      ws.send(JSON.stringify({ command: 'join', payload: { playerId: user.id, room: roomId } }));
    });

    // サーバからメッセージが来たら処理する
    ws.addEventListener('message', async (event) => {
      const response = JSON.parse(event.data);

      // roomdataが来たら画面を初期化する
      if(response.type === 'roomdata') {
        const roomData = response.payload.roomData;
        const playerData = response.payload.playerData;

        renderEnemyDataList(roomData.enemies);
        renderPlayerParty(playerData, ws, user);
      }

      // アニメーションが返ってきたら再生する
      if(response.type === 'turnanimation') {
        const roomData = response.payload.roomData;
        const playerData = response.payload.playerData;

        await playAnimation(response.payload.animations);

        renderEnemyDataList(roomData.enemies);
        renderPlayerParty(playerData, ws, user);

        attackButton.style.visibility = 'visible';
      }

      // アビリティアニメーションが返ってきたら再生する
      if(response.type === 'abilityanimation') {
        const roomData = response.payload.roomData;
        const playerData = response.payload.playerData;

        await playAnimation(response.payload.animations);

        renderEnemyDataList(roomData.enemies);
        renderPlayerParty(playerData, ws, user);
      }
    });

    // 攻撃ボタンをクリックしたらサーバにコマンドを送信する
    attackButton.addEventListener('click', (event) => {
      attackButton.style.visibility = 'hidden';
      ws.send(JSON.stringify({
        command: 'attack',
        payload: {
          playerId: user.id,
          room: roomId,
          enableChargeAttack: true
        }
      }));
    });
  });