// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { MODULE_KEYS, MODULE_SLOTS, TURRET_MOUNTS, GAME_CONFIG, createLevels, moduleCount, getShip, type Levels, type UpgradeKey } from './balance.ts';

// Small equipment schematics stay sharp at every size and travel with the offline build.
const ship = '<path class="diagram-ship" d="M80 42 65 66 80 61 95 66Z"/><path d="M80 48v10" opacity=".6"/>';
const clusterDiagram=(right=false)=>({color:'#b89aff',label:`${right?'Right':'Left'} cluster pod: three rockets per dock; each bursts into sixteen friendly homing missiles with the same damage as homing pods of the same rank.`,art:`${ship}<g transform="translate(${right?105:55} 47) scale(.666667)"><path d="M-6-13H6v26H-6ZM-3-9V9M0-9V9M3-9V9" fill="currentColor" fill-opacity=".2"/></g><circle cx="120" cy="22" r="8"/><path d="M120 11V3q0-3 4-3m-4 33v8q0 3-4 3M109 22h-9q-3 0-3-4m34 4h9q3 0 3 4m-30-12-6-6m22 22 6 6m-22-6-6 6m22-22 6-6"/><text x="8" y="16" fill="currentColor" stroke="none" font-size="9">3 / DOCK</text><text x="8" y="29" fill="currentColor" stroke="none" font-size="9">16 SEEKERS</text>`});
const turretDiagram=(index:number)=>{
    const mount=TURRET_MOUNTS[index],arc=index===0?'M80 30a23 23 0 0 0 0 46':index===1?'M80 30a23 23 0 0 1 0 46':'M57 53a23 23 0 0 1 46 0';
    const barrel=index===0?'M77 53H63':index===1?'M83 53h14':'M80 50V36';
    return {color:mount.color,label:`${mount.name} dorsal tracking turret: 180 degree field; ranks deal 1, 2 or 3 times base plasma power and share rapid fire.`,art:`<path d="${arc}" stroke-dasharray="3 3" opacity=".65"/>${ship}<circle cx="80" cy="53" r="7" fill="currentColor" fill-opacity=".3"/><path d="${barrel}" stroke-width="4"/><text x="13" y="23" fill="currentColor" stroke="none" font-size="14">180°</text><text x="13" y="73" fill="currentColor" stroke="none" font-size="9">1× / 2× / 3×</text>`};
};
const diagrams = {
    weaponPower: { color: '#00e5ff', label: 'Plasma amplifier: a larger plasma bolt delivers more damage.', art: `
        <path d="M24 49V31m-5 5 5-5 5 5" opacity=".45"/>
        <path d="M21 21h6" stroke-width="3"/><path d="M40 28h17m-5-4 5 4-5 4" opacity=".6"/>
        <path d="M80 41V28" stroke-width="4"/><ellipse cx="80" cy="20" rx="7" ry="11" fill="currentColor" fill-opacity=".3"/>
        <path d="m101 12 5-5m-5 23 5 5m-40-23-5-5m5 23-5 5"/>
        <path d="M118 18h18m-9-9v18" stroke-width="3"/>${ship}` },
    missilePower: { color:'#d5a4ff',label:'Missile damage: a shared warhead upgrade powers homing missiles and every seeker from both cluster pods.',art:`
        <path d="M58 62V28l10-15 10 15v34ZM58 49l-8 10m28-10 8 10M63 28h10M68 65v9" fill="currentColor" fill-opacity=".18"/>
        <path d="M38 30h-9m3-12-7-7m58 2 7-7M93 32h25m-12-12v24" stroke-width="3"/>
        <path d="M101 62h30m-15-7v14" opacity=".6"/><text x="8" y="72" fill="currentColor" stroke="none" font-size="11">ALL MISSILES +3</text>` },
    spread: { color: '#f678ff', label: 'Multishot: shotgun pellets spread out; total volley damage is the square root of the pellet count times base plasma power.', art: `
        <path d="m80 43-33-28m33 28V10m0 33 33-28" stroke-dasharray="3 5" opacity=".65"/>
        <path d="m44 16 5-7m31 9V8m31 8-5-7" stroke-width="4"/>
        <path d="M39 32 24 21m97 11 15-11" opacity=".45"/>${ship}` },
    sideGuns: { color: '#ffaa44', label: 'Side cannons: twin horizontal guns fire left and right with each main volley, at 1, 2 or 3 times base plasma power.', art: `
        <path d="M60 55H46V45h14m40 10h14V45h-14" fill="currentColor" fill-opacity=".15"/>
        <path d="M46 50H20m94 0h26" stroke-dasharray="4 4"/>
        <path d="M15 50H7m138 0h8" stroke-width="4"/>
        <path d="M80 36V22" opacity=".4"/>${ship}` },
    missiles: { color: '#b89aff', label: 'Homing pods: guided missiles curve toward a marked enemy.', art: `
        <path d="M67 58C25 62 30 16 65 20s33 20 56-1" stroke-dasharray="3 4" opacity=".6"/>
        <g transform="translate(48 23) rotate(30)"><path d="m0-10 5 6v12H-5V-4Z" fill="currentColor" fill-opacity=".25"/><path d="m-5 5-4 5m14-5 4 5M0 10v7"/></g>
        <path d="m126 8 10 10-10 10-10-10ZM126 4v7m0 14v7m-18-14h11m15 0h10"/>${ship}` },
    megaCannon: {color:'#ffb35d',label:'Mega cannon: under-hull gun fires halfway between every main volley; ranks deal 3, 6 or 9 times base plasma power and share rapid fire.',art:`<path d="M73 65V35h14v30ZM77 35V13h6v22" fill="currentColor" fill-opacity=".2"/>${ship}<path d="M80 8V2" stroke-width="7"/><path d="M70 25v-5m20 17v-5" stroke="#48e6ff" stroke-width="3"/><text x="10" y="29" fill="currentColor" stroke="none" font-size="13">3–9×</text>`},
    cluster: clusterDiagram(),
    clusterRight: clusterDiagram(true),
    turret: turretDiagram(0),
    turretRight: turretDiagram(1),
    turretFront: turretDiagram(2),
    fireRate: { color: '#fff16b', label: 'Rapid fire: a tightly spaced stream of shots leaves the cannon faster.', art: `
        <path d="M80 39v-6m0-7v-6m0-7V7" stroke-width="4"/>
        <path d="M69 35h-9m9-12H56m13-12H52" opacity=".5"/>
        <path d="M103 40V12l-5 5m5-5 5 5"/>
        <path d="M114 29a12 12 0 1 1 15 9m-7-1 7 1-1-7" opacity=".65"/>${ship}` },
    speed: { color: '#ff9860', label: 'Engine tuning: stronger thrusters propel the ship forward.', art: `
        <path d="M80 34V9l-6 7m6-7 6 7" stroke-width="2.5"/>
        <path d="M46 23v17m-9-8v20m77-29v17m9-8v20" opacity=".45"/>
        ${ship}<path d="m74 64 6 13 6-13m-18 0-3 8m30-8 3 8" fill="currentColor" fill-opacity=".25"/>` },
    shieldGen: { color: '#68b4ff', label: 'Shield generator: a recharging barrier surrounds the ship.', art: `
        <path d="M80 5 116 19v25c0 17-23 27-36 33-13-6-36-16-36-33V19Z" fill="currentColor" fill-opacity=".08"/>
        <path d="M80 13 108 24v18" opacity=".45"/>
        ${ship}<path d="M76 27h8m-4-4v8" stroke-width="3"/>
        <path d="M127 48a14 14 0 0 1 5-24m-4-5 4 5-6 3" opacity=".75"/>` },
    magnet: { color: '#ffe45e', label: 'Magnet system: nearby credit pickups are pulled toward the ship.', art: `
        <ellipse cx="80" cy="43" rx="61" ry="32" stroke-dasharray="2 5" opacity=".35"/>
        <circle cx="26" cy="33" r="7" fill="currentColor" fill-opacity=".2"/><circle cx="128" cy="24" r="7" fill="currentColor" fill-opacity=".2"/>
        <path d="M26 29v8m-3-6h6m99-11v8m-3-6h6"/>
        <path d="m38 34 20 10-7 1m59-12-15 13 1-7"/>
        ${ship}<path d="M73 39v-9h14v9m-14-4h5m4 0h5" stroke-width="3"/>` },
    repair: { color: '#ffb454', label: 'Hull repair: a repair tool patches the ship and restores integrity.', art: `
        ${ship}<path d="m79 45 5 6-8 5 6 6" stroke="#ff6685"/>
        <path d="m40 56 20-20a12 12 0 0 0 14-15l-8 8-7-7 8-8a12 12 0 0 0-15 14L32 48Z" fill="currentColor" fill-opacity=".15"/>
        <circle cx="39" cy="49" r="2"/><path d="M114 31h22m-11-11v22" stroke-width="4"/>
        <path d="M104 57h35" opacity=".35"/><path d="M104 57h22" stroke-width="4"/>` },
};

export function shopDiagram(key: UpgradeKey | 'repair') {
    const { color, label, art } = diagrams[key];
    return `<svg class="shop-diagram" viewBox="0 0 160 80" role="img" aria-label="${label}" style="color:${color}">
        <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 15V5h14m136 10V5h-14M5 65v10h14m136-10v10h-14" opacity=".25"/>
            ${art}
        </g>
    </svg>`;
}

type LoadoutPlayer = {
    shipId?: string;
    damage: number; mainShotDamage:number; missileBaseDamage:number; fireDelay: number; spreadCount: number; missileLevel: number;
    speedBase: number; regenShield: number; maxRegenShield: number; magnetRange: number;
    hull: number; maxHull: number; tempShield: number; buffs: Record<string, number>;
    clusterAmmo?:number;clusterRightAmmo?:number;
};

export function shipLoadout(levels: Levels, player: LoadoutPlayer) {
    levels={...createLevels(),...levels};
    const mount=(key:UpgradeKey,art:string)=>`<g class="${levels[key]?'fitting-installed':'fitting-empty'}" style="color:${diagrams[key].color}" stroke="currentColor" fill="currentColor" fill-opacity=".14">${art}</g>`;
    const modules=MODULE_KEYS.map(key=>`${GAME_CONFIG.UPGRADES[key].name} ${levels[key]?`rank ${levels[key]}`:'empty'}`);
    const readout=(label:string,value:string)=>`<div class="loadout-readout"><dt>${label}</dt><dd>${value}</dd></div>`;
    return `<div class="loadout-heading"><h2>YOUR ${getShip(player.shipId).name}</h2><span>WEAPONS ${moduleCount(levels)}/${MODULE_SLOTS}</span></div>
    <div class="loadout-body"><svg class="loadout-ship" viewBox="0 0 360 220" role="img" aria-label="Current ship: ${modules.join('; ')}; Magnet ${levels.magnet?'rank '+levels.magnet:'off'}. Hull ${Math.ceil(player.hull)} of ${player.maxHull}.">
    <g stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="180" cy="109" rx="86" ry="93" fill="#68b4ff08" stroke="#68b4ff" opacity="${player.regenShield>0?.6:.2}"/>
    ${mount('megaCannon','<path d="M169 154V75h22v79ZM176 75V7h8v68m-18 61h28"/>')}
    <path d="m180 31-58 130 37-13 21 21 21-21 37 13Z" fill="#0a1928" stroke="#b9efff"/>
    <path d="m180 57-12 33 12 18 12-18Z" fill="${getShip(player.shipId).color}33" stroke="${getShip(player.shipId).color}"/>
    ${mount('spread','<path d="M172 39V17m8 22V10m8 29V17"/>')}
    ${mount('sideGuns','<path d="M136 128h-21v22h21m88-22h21v22h-21M115 139h-18m148 0h18"/>')}
    ${mount('missiles','<rect x="145" y="103" width="12" height="28" rx="3"/><rect x="203" y="103" width="12" height="28" rx="3"/>')}
    ${mount('cluster','<g transform="translate(119.5 108) scale(.666667)"><path d="M-14.5 20V-20h29v40Zm5-34v22m9-22v22m9-22v22"/></g>')}
    ${mount('clusterRight','<g transform="translate(240.5 108) scale(.666667)"><path d="M-14.5 20V-20h29v40Zm5-34v22m9-22v22m9-22v22"/></g>')}
    ${mount('turret','<circle cx="153" cy="126" r="10"/><path d="M150 126h-20" stroke-width="5"/>')}
    ${mount('turretRight','<circle cx="207" cy="126" r="10"/><path d="M210 126h20" stroke-width="5"/>')}
    ${mount('turretFront','<circle cx="180" cy="87" r="10"/><path d="M180 84V65" stroke-width="5"/>')}
    ${mount('magnet','<path d="M174 152v-8h12v8"/>')}
    <path d="m171 164-3 19 12 25 12-25-3-19" fill="#ff986033" stroke="#ffae62"/>
    <g fill="#89a6b8" stroke="none" font-family="monospace" font-size="9"><text x="17" y="20">MOUNTING SCHEMATIC</text><text x="17" y="207">● FITTED / ┄ EMPTY</text></g></g></svg>
    <div class="loadout-fittings">${MODULE_KEYS.map(key=>`<div class="${levels[key]?'installed':'empty'}" style="--fitting:${diagrams[key].color}"><span>${GAME_CONFIG.UPGRADES[key].name}</span><b>${levels[key]?`R${levels[key]}`:'EMPTY'}</b></div>`).join('')}</div>
    <div class="loadout-details"><dl>
    ${readout('HULL',`${Math.ceil(player.hull)}/${player.maxHull}`)}${readout('PLASMA',`${Math.round(player.damage)} DMG`)}
    ${readout('MISSILE',`${Math.round(player.missileBaseDamage)} DMG`)}
    ${readout('VOLLEY',`${player.spreadCount} × ${player.mainShotDamage.toFixed(1)} DMG`)}
    ${readout('FIRING',`${(1000/player.fireDelay).toFixed(1)}/SEC`)}${readout('SHIELD',`${Math.ceil(player.regenShield)}/${player.maxRegenShield}`)}
    ${readout('ENGINES',`${player.speedBase.toFixed(1)} SPEED`)}${readout('MAGNET',player.magnetRange?`${player.magnetRange} RANGE`:'OFF · NOT FITTED')}
    </dl></div></div><div class="loadout-ammo">LEFT ${player.clusterAmmo||0}/${levels.cluster?3:0} · RIGHT ${player.clusterRightAmmo||0}/${levels.clusterRight?3:0}<br>R: ONE ROCKET · RELOAD AT EACH DOCK</div>
    ${Object.entries(player.buffs).some(([,n])=>n>0)?`<div class="loadout-buffs">${Object.entries(player.buffs).filter(([,n])=>n>0).map(([key,n])=>`${({buff_guns:'EXTRA GUNS',buff_missiles:'HOMING BARRAGE',buff_rapid:'RAPID FIRE',buff_plasma:'ULTRA PLASMA'})[key]} · ${Math.ceil(n/1000)}s`).join(' / ')}</div>`:''}`;
}
