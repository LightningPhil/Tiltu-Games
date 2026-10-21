// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
// Combat is paced by encounters, rather than multiplying every enemy stat by time.
export const WAVE_COUNT = 30;
export const WAVE_DURATION_MS = 40_000;
export const SHOP_WAVE_INTERVAL = 2;
export const MODULE_SLOTS = 9;
export const MODULE_KEYS = ['spread', 'sideGuns', 'missiles', 'megaCannon', 'cluster', 'clusterRight', 'turret', 'turretRight', 'turretFront'] as const;
export const ORDNANCE_KEYS = ['missiles', 'cluster', 'clusterRight'] as const;
export const TURRET_MOUNTS = [
    { key:'turret', name:'LEFT', x:-9, y:4, axis:Math.PI, color:'#7cf6bd' },
    { key:'turretRight', name:'RIGHT', x:9, y:4, axis:0, color:'#52dcd6' },
    { key:'turretFront', name:'FORWARD', x:0, y:-9, axis:-Math.PI/2, color:'#bcf58b' },
] as const;
export const CREDIT_VALUE = .45;
export const COIN_VALUE = CREDIT_VALUE * 1.40625;
export const ENEMY_DAMAGE_MULTIPLIER = 1.125;
export const ENEMY_PROJECTILE_DAMAGE_MULTIPLIER = 1.5;
export const STEP_MS = 1000 / 60;

export const GAME_CONFIG = {
    BASE_SHIP_VALUE: 2000, FULL_REPAIR_VALUE_FRACTION: .1,
    HIT_GRACE_MS: 450, SHIELD_REGEN_DELAY_MS: 3500,
    CLEAR_HULL_REPAIR: 6, CLEAR_SHIELD_FRACTION: .25,
    ENEMY_PLASMA_COLOR: '#4d8dff',
    PLAYER_MISSILE_COLOR: '#aa00ff',
    CLUSTER: { COLOR: '#aa00ff', HOMING_DELAY_MS: 350, SEEKER_LIFETIME_MS: 6000, SEEKER_SPEED: 6, TURN_RATE: 2.6, PROXIMITY: 55 },
    SPAWN_RATES: { AMBIENT_COIN: 0.003, LOOT_CRATE: 0.0025 },
    LOOT_CHANCES: { COIN_JACKPOT: .45, SUPPORT_ITEM: .3, WEAPON_BUFF: .25 },
    LOOT_DETAILS: { COIN_CACHE_COUNT: 3, COIN_CACHE_VALUE: 20, BUFF_DURATION_MS: 10_000, OVERSHIELD_AMOUNT: 35 },
    MAGNET: { BASE_RANGE: 60, RANGE_PER_LEVEL: 10, PULL_STRENGTH: 8, BONUS_ITEM_PULL_FACTOR: 0.5 },
    PLAYER: { MAX_HULL: 80, RADIUS: 12, BASE_SPEED: 5, BASE_DAMAGE: 24, BASE_MISSILE_DAMAGE: 24, BASE_FIRE_RATE: 240, BASE_SHIELD: 25 },
    UPGRADES: {
        weaponPower: { name: 'PLASMA DAMAGE', baseCost: 80, max: 30, description: '+3 base plasma power. Powers main pellets, side cannons, the mega cannon and all tracking turrets.' },
        missilePower: { name: 'MISSILE DAMAGE', baseCost: 80, max: 30, description: '+3 base missile damage. Powers homing pods and every seeker from both cluster pods.' },
        spread: { name: 'MULTISHOT', baseCost: 210, max: 12, description: '+1 shotgun pellet per rank. Combined damage is √(pellet count) × plasma power; each pellet is weaker.' },
        sideGuns: { name: 'SIDE CANNONS', baseCost: 275, max: 3, description: 'Twin horizontal guns: 1× / 2× / 3× base plasma power. Fire with the main volley; share plasma and rapid fire.' },
        missiles: { name: 'HOMING PODS', baseCost: 280, max: 3, description: 'Automatic guided fire. Ranks give 1× / 2× / 3× missile damage; prices are 1× / 2× / 3× base.' },
        megaCannon: { name: 'MEGA CANNON', baseCost: 950, max: 3, description: 'Under-hull gun: 3× / 6× / 9× base plasma power. Fires halfway between main volleys. Shares plasma and rapid fire.' },
        cluster: { name: 'LEFT CLUSTER POD', baseCost: 780, max: 3, description: '3 rockets per dock; 16 friendly homing missiles each. 1× / 2× / 3× missile damage per seeker. R to fire.' },
        clusterRight: { name: 'RIGHT CLUSTER POD', baseCost: 780, max: 3, description: 'A second 3-round pod. 16 friendly seekers; 1× / 2× / 3× missile damage each. R alternates sides.' },
        turret: { name: 'LEFT TURRET', baseCost: 550, max: 3, description: 'Left 180° auto aim. 1× / 2× / 3× base plasma power. Shares plasma, rapid fire and staggered timing.' },
        turretRight: { name: 'RIGHT TURRET', baseCost: 550, max: 3, description: 'Right 180° auto aim. 1× / 2× / 3× base plasma power. Shares plasma, rapid fire and staggered timing.' },
        turretFront: { name: 'FORWARD TURRET', baseCost: 550, max: 3, description: 'Forward 180° auto aim. 1× / 2× / 3× base plasma power. Shares plasma, rapid fire and staggered timing.' },
        fireRate: { name: 'RAPID FIRE', baseCost: 90, max: 30, description: '+4% main firing speed per rank. Auxiliary guns follow its cadence.' },
        speed: { name: 'ENGINE TUNING', baseCost: 90, max: 20, description: '+0.1 movement speed per rank.' },
        shieldGen: { name: 'SHIELD GENERATOR', baseCost: 110, max: 20, description: '+5 capacity and +0.5 recharge/sec per rank.' },
        magnet: { name: 'MAGNET SYSTEM', baseCost: 120, max: 15, description: 'Install a 60-range magnet; each later rank adds 10 range.' },
    },
    // fireDelay is milliseconds per volley; warning pulses precede every shot.
    ENEMIES: {
        BASIC:        { hp: 35, damage: 8, speed: 2.4, score: 14, color: '#ff0055', radius: 20, fireDelay: 2100, threat: 1 },
        INTERMEDIATE: { hp: 65, damage: 9, speed: 2.1, score: 22, color: '#ffaa00', radius: 25, fireDelay: 2200, threat: 1.5 },
        CORVETTE:     { hp: 90, damage: 9, speed: 2.8, score: 32, color: '#00ffaa', radius: 20, fireDelay: 1900, threat: 2 },
        ADVANCED:     { hp: 150, damage: 11, speed: 1.6, score: 40, color: '#9900ff', radius: 35, fireDelay: 2400, threat: 2.5 },
        BOMBER:       { hp: 240, damage: 12, speed: 1.2, score: 65, color: '#00ff00', radius: 45, fireDelay: 3000, threat: 3 },
        DESTROYER:    { hp: 380, damage: 12, speed: 1, score: 90, color: '#aa5500', radius: 60, fireDelay: 2800, threat: 4 },
        INTERCEPTOR:  { hp: 80, damage: 8, speed: 3.6, score: 40, color: '#00ffff', radius: 15, fireDelay: 1700, threat: 2 },
        FRIGATE:      { hp: 320, damage: 16, speed: 1.2, score: 85, color: '#ff0000', radius: 50, fireDelay: 3400, threat: 4 },
        DREADNOUGHT:  { hp: 900, damage: 14, speed: 0.7, score: 160, color: '#ffffff', radius: 70, fireDelay: 2600, threat: 6 },
        STRAFER:      { hp: 160, damage: 11, speed: 1.5, score: 60, color: '#ff80a8', radius: 28, fireDelay: 1900, threat: 2.5 },
        LANCER:       { hp: 210, damage: 13, speed: 2.1, score: 75, color: '#aa91ff', radius: 24, fireDelay: 2500, threat: 3 },
        CARRIER:      { hp: 620, damage: 15, speed: .8, score: 130, color: '#7ae8c0', radius: 58, fireDelay: 3000, threat: 5 },
        INVADER:      { hp: 700, damage: 12, speed: 0, score: 140, color: '#b89aff', radius: 27, fireDelay: 1600, threat: 4 },
    },
    MISSILE_LIFETIME: 180, PLAYER_MISSILE_SPEED: 8, ENEMY_MISSILE_SPEED: 3,
};

export type UpgradeKey = keyof typeof GAME_CONFIG.UPGRADES;
export type EnemyType = keyof typeof GAME_CONFIG.ENEMIES;
export type Levels = Record<UpgradeKey, number>;
export const SHIPS = {
    vanguard: { name: 'VANGUARD', hull: 80, shield: 25, damage: 1, speed: 0, dashCooldown: 3200, unlock: 0, color: '#48e6ff', description: 'Balanced fighter · 80 hull / 25 shield' },
    striker: { name: 'STRIKER', hull: 60, shield: 15, damage: 1.2, speed: .4, dashCooldown: 3200, unlock: 10, color: '#ff9860', description: '+20% damage · 60 hull / 15 shield' },
    spectre: { name: 'SPECTRE', hull: 65, shield: 20, damage: .95, speed: .5, dashCooldown: 2200, unlock: 20, color: '#b89aff', description: '2.2s dash · 65 hull / 20 shield' },
};
export type ShipId = keyof typeof SHIPS;
export function getShip(id: string = 'vanguard') { return SHIPS[Object.hasOwn(SHIPS,id) ? id as ShipId : 'vanguard']; }
export const ACTS = [
    { name: 'OUTER BLOCKADE', color: '#48e6ff', detail: 'Break through the patrol line', background: '#081728' },
    { name: 'SHATTERED REACH', color: '#ffb887', detail: 'Hunt the raider fleet', background: '#231324' },
    { name: 'THE MACHINE CORE', color: '#b89aff', detail: 'Silence the command network', background: '#101c25' },
];
export function getAct(wave: number) { const index=Math.min(2,Math.max(0,Math.floor((wave-1)/10)));return {...ACTS[index],number:index+1}; }
export const COMMANDERS = [
    { wave:5, name:'PATROL COMMANDER', type:'DESTROYER' as EnemyType, hp:2600, radius:60, pattern:'fan', fireDelay:1200 },
    { wave:10, name:'BLOCKADE FLAGSHIP', type:'DREADNOUGHT' as EnemyType, hp:8500, radius:70, pattern:'orbit', fireDelay:1350 },
    { wave:15, name:'RAIDER ACE', type:'STRAFER' as EnemyType, hp:11500, radius:48, pattern:'crossfire', fireDelay:1250 },
    { wave:20, name:'SIEGE ARK', type:'CARRIER' as EnemyType, hp:15000, radius:76, pattern:'missiles', fireDelay:1750 },
    { wave:25, name:'PRISM WARDEN', type:'ADVANCED' as EnemyType, hp:19000, radius:62, pattern:'spiral', fireDelay:1450 },
    { wave:30, name:'CORE INVASION FLEET', type:'INVADER' as EnemyType, hp:112500, radius:27, pattern:'invasion', fireDelay:1050 },
];
export const INVASION = {
    rows:4, wideColumns:5, narrowColumns:4, radius:27, rowSpacing:72,
    rowHull:[4500,4000,3500,3000], hullMultiplier:1.5,
    speed:88, lastSpeed:210, accelerationMs:120,
    descent:40, descentDuration:650, warning:450, openingGrace:2400,
    shotDelay:1050, lastShotDelay:750, shotSpeed:4.8,
};
export function getCommander(wave: number) {
    const stage=wave>WAVE_COUNT?WAVE_COUNT-5+(wave-WAVE_COUNT)%10:wave;
    return COMMANDERS.find(boss=>boss.wave===stage)??COMMANDERS[COMMANDERS.length-1];
}
export function isCommanderWave(wave: number) { return wave%5===0; }
export function createLevels(): Levels {
    return { weaponPower: 0, missilePower:0, spread: 0, sideGuns: 0, missiles: 0, megaCannon:0,cluster:0,clusterRight:0,turret:0,turretRight:0,turretFront:0,fireRate: 0, speed: 0, shieldGen: 0, magnet: 0 };
}
export function moduleCount(levels: Levels) {
    return MODULE_KEYS.filter(key => levels[key] > 0).length;
}
export function getUpgradeCost(key: UpgradeKey, levels: Levels) {
    if(key==='megaCannon')return GAME_CONFIG.UPGRADES.megaCannon.baseCost * ((levels.megaCannon||0)+1) / 2;
    if(TURRET_MOUNTS.some(m=>m.key===key)||ORDNANCE_KEYS.includes(key as typeof ORDNANCE_KEYS[number]))return GAME_CONFIG.UPGRADES[key].baseCost*((levels[key]||0)+1);
    if(key==='sideGuns')return Math.round(getUpgradeCost('turret',{...levels,turret:levels.sideGuns||0})/2);
    return Math.round(GAME_CONFIG.UPGRADES[key].baseCost * 1.14 ** (levels[key]||0));
}
export function getSalvageValue(key: UpgradeKey, levels: Levels) {
    if (!MODULE_KEYS.includes(key as typeof MODULE_KEYS[number])) return 0;
    return getUpgradeScrapValue(key, levels);
}
export function getUpgradeScrapValue(key: UpgradeKey, levels: Levels) {
    let paid = 0;
    for (let rank = 0; rank < levels[key]; rank++) paid += getUpgradeCost(key, { ...levels, [key]: rank });
    return Math.floor(paid * .6);
}
export function getShipValue(levels: Levels) {
    return GAME_CONFIG.BASE_SHIP_VALUE + (Object.keys(GAME_CONFIG.UPGRADES) as UpgradeKey[])
        .reduce((value,key)=>value+getUpgradeScrapValue(key,levels),0);
}
export function getRepairCost(levels: Levels, hull: number, maxHull: number) {
    const missingFraction=Math.max(0,Math.min(1,(maxHull-hull)/maxHull));
    return Math.ceil(getShipValue(levels)*GAME_CONFIG.FULL_REPAIR_VALUE_FRACTION*missingFraction);
}
export function upgradeLock(key: UpgradeKey, levels: Levels, wave: number) {
    if (levels[key] >= GAME_CONFIG.UPGRADES[key].max) return 'MAX RANK';
    return '';
}
export function getMultishotStats(damage:number,shotCount:number) {
    return { mainShotDamage:damage/Math.sqrt(shotCount),volleyDamage:damage*Math.sqrt(shotCount) };
}
export function getPlayerStats(levels: Levels, shipId: string = 'vanguard') {
    const ship=getShip(shipId);
    levels={...createLevels(),...levels};
    const missileBaseDamage=Math.round((GAME_CONFIG.PLAYER.BASE_MISSILE_DAMAGE+levels.missilePower*3)*ship.damage);
    const damage=Math.round((GAME_CONFIG.PLAYER.BASE_DAMAGE + levels.weaponPower * 3)*ship.damage),spreadCount=1+levels.spread;
    return {
        damage,...getMultishotStats(damage,spreadCount),
        fireDelay: GAME_CONFIG.PLAYER.BASE_FIRE_RATE / (1 + levels.fireRate * 0.04),
        spreadCount, missileLevel: levels.missiles,
        missileBaseDamage,missileCount:levels.missiles?1:0,missileDamage:missileBaseDamage*levels.missiles,
        missileDelay:1500,
        sideGunLevel: levels.sideGuns, sideDamageFactor: levels.sideGuns,
        megaLevel:levels.megaCannon,megaDamageFactor:levels.megaCannon*3,megaSpeed:15,megaRadius:6+levels.megaCannon,
        clusterLevel:levels.cluster,clusterSpeed:5,clusterDamage:missileBaseDamage*levels.cluster,
        clusterRightLevel:levels.clusterRight,clusterRightSpeed:5,clusterRightDamage:missileBaseDamage*levels.clusterRight,
        clusterCapacity:(Number(levels.cluster>0)+Number(levels.clusterRight>0))*3,
        turretLevel:levels.turret,turretRightLevel:levels.turretRight,turretFrontLevel:levels.turretFront,
        turretLevels:{turret:levels.turret,turretRight:levels.turretRight,turretFront:levels.turretFront},turretSpeed:15,turretTurn:8,
        speedBase: GAME_CONFIG.PLAYER.BASE_SPEED + levels.speed * 0.1 + ship.speed,
        maxRegenShield: ship.shield + levels.shieldGen * 5,
        regenPerSecond: 1.5 + levels.shieldGen * .5,
        magnetRange: levels.magnet === 0 ? 0 : GAME_CONFIG.MAGNET.BASE_RANGE + (levels.magnet - 1) * GAME_CONFIG.MAGNET.RANGE_PER_LEVEL,
    };
}

const WAVES: { name: string; pool: EnemyType[] }[] = [
    { name: 'FIRST CONTACT', pool: ['BASIC'] },
    { name: 'CROSS FIRE', pool: ['BASIC', 'INTERMEDIATE'] },
    { name: 'FAST APPROACH', pool: ['BASIC', 'INTERMEDIATE', 'CORVETTE'] },
    { name: 'PLASMA FRONT', pool: ['INTERMEDIATE', 'CORVETTE', 'ADVANCED'] },
    { name: 'HEAVY PATROL', pool: ['BASIC', 'ADVANCED', 'BOMBER'] },
    { name: 'INTERCEPTION', pool: ['CORVETTE', 'INTERCEPTOR', 'ADVANCED'] },
    { name: 'SIEGE LINE', pool: ['INTERMEDIATE', 'BOMBER', 'DESTROYER'] },
    { name: 'MISSILE SCREEN', pool: ['CORVETTE', 'INTERCEPTOR', 'FRIGATE'] },
    { name: 'LAST DEFENCE', pool: ['ADVANCED', 'BOMBER', 'DESTROYER', 'FRIGATE'] },
    { name: 'BREAK THE BLOCKADE', pool: ['CORVETTE', 'INTERCEPTOR', 'FRIGATE', 'DESTROYER'] },
    { name: 'RAIDER TERRITORY', pool: ['CORVETTE','STRAFER','ADVANCED'] },
    { name: 'FLANKING MANOEUVRE', pool: ['STRAFER','INTERCEPTOR','BOMBER'] },
    { name: 'SILENT CONVOY', pool: ['FRIGATE','STRAFER','DESTROYER'] },
    { name: 'THE HUNTING GROUND', pool: ['STRAFER','INTERCEPTOR','ADVANCED'] },
    { name: 'RAIDER STRONGHOLD', pool: ['STRAFER','CORVETTE','DESTROYER'] },
    { name: 'LANCE SQUADRON', pool: ['LANCER','ADVANCED','INTERCEPTOR'] },
    { name: 'HEAVY SHIPPING', pool: ['DESTROYER','BOMBER','STRAFER'] },
    { name: 'MISSILE ALLEY', pool: ['FRIGATE','LANCER','CORVETTE'] },
    { name: 'ARK ESCORT', pool: ['DREADNOUGHT','STRAFER','LANCER'] },
    { name: 'BREAK THE SIEGE', pool: ['FRIGATE','DESTROYER','LANCER'] },
    { name: 'CARRIER SIGNAL', pool: ['CARRIER','CORVETTE','ADVANCED'] },
    { name: 'DEFENCE NETWORK', pool: ['CARRIER','LANCER','STRAFER'] },
    { name: 'DREADNOUGHT PASSAGE', pool: ['DREADNOUGHT','FRIGATE','INTERCEPTOR'] },
    { name: 'PRISM ARRAY', pool: ['ADVANCED','LANCER','CARRIER'] },
    { name: 'THE INNER WARDEN', pool: ['LANCER','ADVANCED','STRAFER'] },
    { name: 'CORE SENTRIES', pool: ['CARRIER','DREADNOUGHT','CORVETTE'] },
    { name: 'CROSS THE FIREWALL', pool: ['STRAFER','LANCER','FRIGATE'] },
    { name: 'LAST TRANSMISSION', pool: ['CARRIER','DESTROYER','LANCER'] },
    { name: 'COMMAND RESERVE', pool: ['DREADNOUGHT','CARRIER','STRAFER'] },
    { name: 'SILENCE THE CORE', pool: ['CARRIER','LANCER','DREADNOUGHT','INTERCEPTOR'] },
];
export function getWaveProfile(wave: number, viewportWidth = 1200) {
    const stage = WAVES[Math.min(wave, WAVE_COUNT) - 1];
    const progress = Math.min(wave - 1, 9), chapter=Math.min(2,Math.floor((wave-1)/10));
    const areaScale = Math.max(0.55, Math.min(1, viewportWidth / 1000));
    return { ...stage, name: wave > WAVE_COUNT ? `ENDLESS ${wave - WAVE_COUNT}` : stage.name,
        spawnDelay: Math.max(700, 1550 - progress * 85),
        maxThreat: (6 + progress * 0.9) * areaScale,
        budget: (22 + progress * 4 + chapter*5) * areaScale, reward: Math.round((100 + Math.min(wave,20) * 18)*CREDIT_VALUE),
    };
}
export function releasedThreat(budget: number, combatTime: number) {
    // Keep encounters arriving through the wave instead of exhausting the budget
    // in its first half. A small opening reserve allows readable formations.
    return budget * (.15 + .85 * Math.min(1, Math.max(0, combatTime) / (WAVE_DURATION_MS - 4000)));
}
export function getEnemyHullBonus(wave:number) { return 1+.5*Math.max(0,Math.min(1,(wave-1)/(WAVE_COUNT-1))); }
export function getEnemyScale(wave: number) {
    // Endless adds modest health only; damage and density retain readable ceilings.
    return { hp: (1 + Math.min(wave - 1, 9) * 0.16 + Math.max(0,Math.min(wave,30)-10)*.055+Math.max(0,wave-30)*.04)*getEnemyHullBonus(wave),
        hullBonus:getEnemyHullBonus(wave),
        damage: 1 + Math.min(wave - 1, 9) * 0.04 };
}
export function getPracticeLevels(wave:number):Levels {
    const progress=Math.max(0,Math.min(1,(wave-1)/(WAVE_COUNT-1)));
    return {...createLevels(),weaponPower:Math.floor(progress*10),missilePower:Math.floor(progress*4),fireRate:Math.floor(progress*8),shieldGen:Math.floor(progress*6),speed:Math.floor(progress*2),spread:Math.floor(progress*3),
        megaCannon:progress>=.7?2:progress>=.2?1:0,turret:progress>=.4?1:0,turretRight:progress>=.55?1:0,turretFront:progress>=.75?1:0,
        missiles:progress>=.3?1:0,cluster:progress>=.6?1:0,clusterRight:progress>=.85?1:0,magnet:progress>=.15?1:0};
}
export function chooseEnemy(pool: EnemyType[], remainingThreat: number, random = Math.random): EnemyType | null {
    const eligible = pool.filter(type => GAME_CONFIG.ENEMIES[type].threat <= remainingThreat);
    if (!eligible.length) return null;
    // Heavy units occupy more of the encounter, so fewer of them are selected.
    const total = eligible.reduce((sum, type) => sum + 1 / GAME_CONFIG.ENEMIES[type].threat, 0);
    let roll = random() * total;
    return eligible.find(type => (roll -= 1 / GAME_CONFIG.ENEMIES[type].threat) < 0) ?? eligible[eligible.length - 1];
}
