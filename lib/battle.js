class BattleRoom {
  constructor(enemyDataList) {
    this._playerMap = new Map();

    this._enemyDataList = enemyDataList.map((e) => ({
      ...e,
      currentHp: e.hp,
      currentCt: 0,
      currentMode: 'normal',
      currentModeGauge: 0,
      status: []
    }));

    this._abilityMap = new Map();
  }

  get playerList() {
    return Array.from(this._playerMap.values());
  }

  get roomData() {
    const self = this;

    return {
      players: self.playerList,
      enemies: self._enemyDataList.map((e) => ({
        name: e.name,
        graphic: e.graphic,
        hp: e.currentHp / e.hp,
        maxCt: e.ct,
        currentCt: e.currentCt,
        currentMode: e.currentMode,
        currentModeGauge: e.currentModeGauge,
        status: e.status
      }))
    };
  }

  joinPlayerParty(playerParty) {
    this._playerMap.set(playerParty._id.toString(), playerParty);
  }

  getPlayerById(id) {
    return this._playerMap.get(id.toString());
  }

  getEnemyByIndex(index) {
    return this._enemyDataList[index];
  }

  calcAttackBaseToEnemy(playerId, character, target) {
    let attackBase = character.attack;

    // バフ・デバフの処理
    character.status.forEach((status) => {
      if('attackMultiplier' in status) {
        attackBase *= status.attackMultiplier;
      }
    });

    target.status.forEach((status) => {
      if('damageMultiplier' in status) {
        attackBase *= status.damageMultiplier;
      }
    });

    return attackBase;
  }

  damageToEnemy(characterIndex, targetIndex, damage) {
    const target = this._enemyDataList[targetIndex];
    const animations = {};

    target.currentHp = Math.max(target.currentHp - damage, 0);
    animations.damageAnimation = {
      type: 'damage',
      characterIndex,
      targetIndex,
      damage,
      enemyHp: target.currentHp / target.hp,
      enemyModeGauge: target.currentModeGauge
    };

    // ODゲージ計算
    if(target.currentMode === 'normal') {
      const diff = damage / target.overdriveDamage;
      target.currentModeGauge = Math.min(target.currentModeGauge + diff, 1.0);
    } else if(target.currentMode === 'overdrive') {
      const diff = damage / target.breakDamage;
      target.currentModeGauge = Math.max(target.currentModeGauge - diff, 0.0);
    }

    // ODモード変化
    if(target.currentMode === 'normal' && target.currentModeGauge === 1) {
      target.currentMode = 'overdrive';
      animations.overdriveAnimation = { type: 'overdrive', targetIndex };
    } else if(target.currentMode === 'overdrive' && target.currentModeGauge === 0) {
      target.currentMode = 'break';
      setTimeout(() => target.currentMode = 'normal',1000 * 30);
      animations.overdriveAnimation = { type: 'break', targetIndex };
    }

    return animations;
  }

  // 敵にバフ・デバフ付与
  addStatusToEnemy(targetIndex, status) {
    const target = this._enemyDataList[targetIndex];
    target.status.push(status);
    setTimeout(() => {
      const index = target.status.indexOf(status);
      if(index >= 0) {
        target.status.splice(index, 1);
      }
    }, status.duration);
  }

  // 味方にバフ・デバフ付与
  addStatusToCharacter(playerId, characterIndex, status) {
    const target = this.getPlayerById(playerId).members[characterIndex];
    target.status.push(status);
  }

  // アビリティ使用
  useAbility(playerId, characterIndex, abilityIndex, targetIndex = 0) {
    const player = this.getPlayerById(playerId);
    const target = this._enemyDataList[targetIndex];

    const ability = player.members[characterIndex].abilities[abilityIndex];
    ability.recast = ability.recastTurn;

    if(!this._abilityMap.has(ability.script)) {
      this._abilityMap.set(ability.script, require(`../ability/${ability.script}`));
    }

    const abilityScript = this._abilityMap.get(ability.script);
    const animation = abilityScript.execute(this, playerId, characterIndex, targetIndex);

    return animation;
  }

  processTurn(playerId, enableChargeAttack, targetIndex = 0) {
    const player = this.getPlayerById(playerId);
    const target = this._enemyDataList[targetIndex];
    const damageAnimations = [];
    const overdriveAnimations = [];
    const receivedDamageAnimations = [];

    // プレイヤー側処理
    player.members.forEach((character, index) => {
      // ダブルアタック、トリプルアタックの判定。確率は適当
      const isDoubleAttack = Math.random() < 0.2;
      const isTripleAttack = Math.random() < 0.1;

      const attackNum = isTripleAttack ? 3 : isDoubleAttack ? 2 : 1;
      const attackBase = this.calcAttackBaseToEnemy(playerId, character, target);

      // 奥義
      if(enableChargeAttack && character.charge >= 100) {
        // 奥義倍率3倍ぐらい
        const damage = Math.round(attackBase * 3 * (1 + Math.random()/10));
        const animation = this.damageToEnemy(index, targetIndex, damage);

        if(animation.damageAnimation) {
          damageAnimations.push(animation.damageAnimation);
        }

        if(animation.overdriveAnimation) {
          overdriveAnimations.push(animation.overdriveAnimation);
        }

        character.charge -= 100;
        return;
      }

      // 攻撃回数の数だけ攻撃する
      for(let i = 0; i < attackNum; i++) {
        // 奥義ゲージ増加
        character.charge = Math.min(character.charge + [10, 12, 15][i], 100);

        // ダメージ計算。計算式は適当。乱数混ぜてたらそれっぽくなるっしょ
        const damage = Math.round(attackBase * (1 + Math.random()/10));
        const animation = this.damageToEnemy(index, targetIndex, damage);

        // クライアントに送信するアニメーションを追加
        if(animation.damageAnimation) {
          damageAnimations.push(animation.damageAnimation);
        }

        if(animation.overdriveAnimation) {
          overdriveAnimations.push(animation.overdriveAnimation);
        }

        // 途中で死んだら終わり
        if(target.currentHp <= 0) {
          break;
        }
      }
    });

    // 敵側処理
    this._enemyDataList.forEach((e, index) => {
      // 攻撃対象をランダムに決める
      const targetIndex = Math.floor(Math.random() * player.members.length);
      const target = player.members[targetIndex];

      // 攻撃
      const damage = Math.round(e.attack * (1 + Math.random()/10));
      target.currentHp = Math.max(target.currentHp - damage, 0);

      // 死
      if(target.currentHp === 0) {
        player.members.splice(targetIndex, 1);
      }

      receivedDamageAnimations.push({
        type: 'receiveddamage',
        targetIndex,
        damage
      });

      // CT進める
      e.currentCt += 1;
      if(e.currentCt > e.ct) {
        e.currentCt = 0;
      }
    });

    // アビリティのリキャストや、バフ・デバフのターンを進める
    player.members.forEach((character) => {
      character.abilities.forEach((ability) => {
        ability.recast = Math.max(ability.recast - 1, 0);
      });

      character.status.forEach((status) => {
        status.remainTurns -= 1;
      });

      character.status = character.status.filter((status) => status.remainTurns > 0);
    });

    // アニメーションは、与ダメージ -> OD -> 被ダメージ、の順
    return [...damageAnimations, ...overdriveAnimations, ...receivedDamageAnimations];
  }
}

module.exports = {
  BattleRoom
};