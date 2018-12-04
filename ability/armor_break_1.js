function execute(room, playerId, characterIndex, targetIndex) {
  const attacker = room.getPlayerById(playerId).members[characterIndex];
  const target = room.getEnemyByIndex(targetIndex);
  const damage = Math.round(room.calcAttackBaseToEnemy(playerId, attacker, target) * (1 + Math.random()/10));
  const damageAnimations = room.damageToEnemy(characterIndex, targetIndex, damage);
  room.addStatusToEnemy(targetIndex, { icon: '🛡⬇️', damageMultiplier: 1.2, duration: 1000 * 60 });

  const animations = [
    damageAnimations.damageAnimation,
    {
      type: 'defencedown',
      targetIndices: [targetIndex]
    }
  ];

  if(damageAnimations.overdriveAnimation) {
    animations.push(damageAnimations.overdriveAnimation);
  }

  return animations;
}

module.exports = {
  execute
};