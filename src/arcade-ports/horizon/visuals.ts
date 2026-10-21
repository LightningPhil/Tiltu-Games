/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import * as THREE from 'three';
import { ENEMIES } from './game.ts';
import type { VisualStyle } from './game.ts';

function craftBounds(type: number, boss: boolean) {
    return boss ? new THREE.Box3(new THREE.Vector3(-41, -6.5, -31), new THREE.Vector3(41, 10.5, 24))
        : new THREE.Box3(new THREE.Vector3(-12 - type * 2, type === 2 ? -2.05 : -1.3, -9), new THREE.Vector3(12 + type * 2, type === 0 ? 3.8 : type === 1 ? 4.26 : 4.5, 14));
}

function createRetroCraft(type: number, boss: boolean) {
    const group = new THREE.Group(), color = boss ? 0xff526b : ENEMIES[type].color;
    const width = 12 + type * 2, top = type === 0 ? 3.8 : type === 1 ? 4.26 : 4.5;
    const points = boss
        ? [[0, 1, 24], [-15, 0, -24], [15, 0, -24], [0, 10.5, -2], [0, -6.5, -4], [-41, 0, -14], [41, 0, -14], [0, 0, -26]]
        : [[0, 0, 14], [-width, 0, -9], [width, 0, -9], [0, top, -3], [0, type === 2 ? -2.05 : -1.3, -3], [0, 0, -9]];
    const faces = boss ? [0, 3, 1, 0, 2, 3, 1, 3, 2, 0, 1, 4, 0, 4, 2, 1, 2, 4, 0, 5, 1, 0, 2, 6, 1, 5, 7, 2, 7, 6]
        : [0, 3, 1, 0, 2, 3, 1, 3, 5, 2, 5, 3, 0, 1, 4, 0, 4, 2, 1, 5, 4, 2, 4, 5];
    const geometry = new THREE.BufferGeometry(), colors: number[] = [];
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces.flatMap(index => points[index]), 3)); geometry.computeVertexNormals();
    const palette = [0x23355d, 0x101c3a, 0x314367, 0x172543];
    faces.forEach((_, index) => { const tint = new THREE.Color(palette[Math.floor(index / 3) % palette.length]); colors.push(tint.r, tint.g, tint.b); });
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const hull = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); group.add(hull);
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), new THREE.LineBasicMaterial({ color })));
    const glow = new THREE.MeshBasicMaterial({ color }), exhaustMaterial = new THREE.MeshBasicMaterial({ color: 0xffa85a, transparent: true, opacity: .8, depthWrite: false });
    const exhausts: any[] = [];
    for (const x of boss ? [-23, 23] : [-6 - type, 6 + type]) {
        const nozzle = new THREE.Mesh(new THREE.BoxGeometry(boss ? 4 : 2, boss ? 4 : 1.5, .3), glow); nozzle.position.set(x, 0, boss ? -24 : -9); group.add(nozzle);
        const plume = new THREE.Mesh(new THREE.ConeGeometry(boss ? 2.5 : 1, boss ? 16 : 6, 4, 1, true), exhaustMaterial);
        plume.rotation.x = -Math.PI / 2; plume.position.set(x, 0, boss ? -31 : -12); group.add(plume); exhausts.push(plume);
        plume.userData = { nozzle: boss ? -24 : -9, length: boss ? 16 : 6 };
    }
    if (boss) {
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(5), new THREE.MeshBasicMaterial({ color: 0xffdc8c, wireframe: true })); core.position.set(0, 1, -26); group.add(core);
        const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0x7fa9ff, wireframe: true, transparent: true, opacity: .3, depthWrite: false })); shield.scale.set(48, 20, 35); group.add(shield);
        group.userData.core = core; group.userData.shield = shield;
    } else group.scale.setScalar(type === 0 ? 1.15 : 1.1);
    group.userData.glow = glow; group.userData.exhausts = exhausts; group.userData.solidBox = craftBounds(type, boss); return group;
}

export function createCraft(type: number, boss = false, style: VisualStyle = 'neon') {
    if (style === 'retro') return createRetroCraft(type, boss);
    const group = new THREE.Group(), color = boss ? 0xff526b : ENEMIES[type].color;
    const dark = new THREE.MeshPhongMaterial({ color: boss ? 0x392b46 : 0x33465e, shininess: 65, flatShading: true, emissive: 0x030710 });
    const edge = new THREE.LineBasicMaterial({ color });
    const glow = new THREE.MeshBasicMaterial({ color });
    group.userData.glow = glow;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, solid = false) => {
        const geometry = new THREE.BoxGeometry(w, h, d), mesh = new THREE.Mesh(geometry, solid ? glow : dark);
        if (!solid) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edge));
        mesh.position.set(x, y, z); group.add(mesh); return mesh;
    };
    if (boss) {
        box(30, 12, 48, 0, 0, 0); box(82, 4, 20, 0, -2, -6);
        box(10, 13, 30, -33, 0, -2); box(10, 13, 30, 33, 0, -2);
        box(18, 5, 21, 0, 8, 4); box(2, 2, 22, -39, 4, -3, true); box(2, 2, 22, 39, 4, -3, true);
        for (const x of [-10, 0, 10]) box(4, 4, 1, x, 0, -24.5, true);
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), new THREE.MeshBasicMaterial({ color: 0xffdc8c, wireframe: true }));
        core.position.set(0, 1, -26); group.add(core); group.userData.core = core;
        const shieldColor = new THREE.Color(0x7fa9ff);
        const shieldMaterial: any = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { color: { value: shieldColor }, time: { value: 0 } },
            vertexShader: `varying vec3 vNormal;varying vec3 vView;varying vec2 vUv;void main(){vUv=uv;vNormal=normalMatrix*normal;vec4 mv=modelViewMatrix*vec4(position,1.0);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
            fragmentShader: `precision mediump float;uniform vec3 color;uniform float time;varying vec3 vNormal;varying vec3 vView;varying vec2 vUv;
            void main(){float edge=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.2);
            float scan=pow(max(0.0,sin(vUv.y*75.0-time*2.2)),28.0);float grid=step(.96,fract(vUv.x*28.0+vUv.y*6.0));
            gl_FragColor=vec4(color,.025+edge*.38+scan*.12+grid*.06);}`,
        }); shieldMaterial.color = shieldColor;
        const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), shieldMaterial);
        shield.scale.set(48, 20, 35); group.add(shield); group.userData.shield = shield;
    } else {
        const width = type === 2 ? 16 : type === 1 ? 14 : 12;
        const shape = new THREE.Shape();
        const points = [[0, 12], [3, 3], [width, -5], [width - 1, -9], [4, -5], [0, -7], [-4, -5], [-width + 1, -9], [-width, -5], [-3, 3]];
        points.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z)); shape.closePath();
        const wingGeometry = new THREE.ExtrudeGeometry(shape, { depth: .7 + type * .3, bevelEnabled: false, steps: 1 }); wingGeometry.rotateX(Math.PI / 2);
        const wing = new THREE.Mesh(wingGeometry, dark); group.add(wing);
        wing.add(new THREE.LineSegments(new THREE.EdgesGeometry(wingGeometry, 25), edge));
        const hull = new THREE.BufferGeometry(), beam = type === 2 ? 5.6 : 3.2, vertices = [[0, 0, 14], [-beam, 0, -6], [beam, 0, -6], [0, type === 2 ? 4.5 : 3.8, -1], [0, -1.3, -3]];
        const triangles = [0, 3, 1, 0, 2, 3, 1, 3, 2, 0, 1, 4, 0, 4, 2, 1, 2, 4];
        hull.setAttribute('position', new THREE.Float32BufferAttribute(triangles.flatMap(index => vertices[index]), 3)); hull.computeVertexNormals();
        group.add(new THREE.Mesh(hull, dark));
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), new THREE.MeshPhongMaterial({ color: 0x87e0ef, emissive: 0x153e58, shininess: 100, flatShading: true }));
        canopy.scale.set(1.8, 1.6, 4); canopy.position.set(0, 2, 1); group.add(canopy);
        for (const side of [-1, 1]) {
            box(2.4, 2.3, 7, side * (6 + type), .1, -5);
            box(1.6, 1.3, .3, side * (6 + type), .1, -8.7, true);
            box(.25, .2, 7, side * (width - 2), .1, -4, true);
            if (type > 0) {
                const fin = box(.55, 4.5, 5, side * 7, 2, -5); fin.rotation.z = side * -.25;
                box(.5, .5, 5, side * 10, -.5, 2, true);
            }
            if (type === 2) {
                box(4, 2.5, 10, side * 11, -.8, -2);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.7, 1.2, 6, 8), dark); barrel.rotation.x = Math.PI / 2; barrel.position.set(side * 11, -.8, 6); group.add(barrel);
                box(1.4, 1.4, .25, side * 11, -.8, 9, true);
            }
        }
        group.scale.setScalar(type === 0 ? 1.15 : 1.1);
    }
    const exhausts: any[] = [];
    const exhaustMaterial = new THREE.MeshBasicMaterial({ color: boss ? 0xff8b67 : 0x70dfff, transparent: true, opacity: .65, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const x of boss ? [-23, 0, 23] : [-6 - type, 6 + type]) {
        const plume = new THREE.Mesh(new THREE.ConeGeometry(boss ? 3 : 1.1, boss ? 19 : 7, 8, 1, true), exhaustMaterial);
        plume.rotation.x = -Math.PI / 2; plume.position.set(x, 0, boss ? -30 : -12); group.add(plume); exhausts.push(plume);
        plume.userData = { nozzle: boss ? -24.8 : -8.9, length: boss ? 19 : 7 };
    }
    group.userData.exhausts = exhausts;
    // Decorative plumes and shields must never enlarge the solid aircraft hit volume.
    group.userData.solidBox = craftBounds(type, boss);
    return group;
}
export function createCockpit(player: any, style: VisualStyle = 'neon') {
    const group = new THREE.Group(); player.add(group);
    const edge = new THREE.LineBasicMaterial({ color: 0x63c7dc, transparent: true, opacity: 0.48 });
    const dark = style === 'retro' ? new THREE.MeshBasicMaterial({ color: 0x050d20 }) : new THREE.MeshPhongMaterial({ color: 0x101d2d, shininess: 80, flatShading: true });
    for (const [w, h, d, x, y, z] of [[3.4, .30, .72, 0, -1.73, -2.7], [.24, .22, 2.0, -1.64, -1.34, -1.8], [.24, .22, 2.0, 1.64, -1.34, -1.8]]) {
        const geometry = new THREE.BoxGeometry(w, h, d), mesh = new THREE.Mesh(geometry, dark);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edge)); mesh.position.set(x, y, z); group.add(mesh);
    }
    const bars = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1.05, -1.55, -2.5), new THREE.Vector3(-0.50, -1.55, -2.5),
        new THREE.Vector3(0.50, -1.55, -2.5), new THREE.Vector3(1.05, -1.55, -2.5),
    ]), new THREE.LineBasicMaterial({ color: 0xffc66e })); group.add(bars);
    if (style === 'retro') return group;
    // Brushed side consoles and small instruments frame the view below the aiming line.
    for (const side of [-1, 1]) {
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(.46, .25), new THREE.MeshBasicMaterial({ color: 0x123c4c, side: THREE.DoubleSide }));
        screen.position.set(side * .90, -1.54, -2.30); screen.rotation.x = -.25; group.add(screen);
        for (let i = 0; i < 5; i++) {
            const light = new THREE.Mesh(new THREE.BoxGeometry(.035, .025, .015), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffc37c : 0x5fc4d4 }));
            light.position.set(side * (.75 + i * .075), -1.54, -2.28); group.add(light);
        }
        const brace = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, 1.7, 6), dark); brace.position.set(side * 2.12, -.65, -2.5); brace.rotation.z = side * -.58;
        group.add(brace);
    }
    const arch = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.85, -1.3, -2.6), new THREE.Vector3(-2.5, .5, -2.7), new THREE.Vector3(-1.7, 1.7, -3),
        new THREE.Vector3(0, 2.15, -3.2), new THREE.Vector3(1.7, 1.7, -3), new THREE.Vector3(2.5, .5, -2.7), new THREE.Vector3(2.85, -1.3, -2.6),
    ]);
    const canopyFrame = new THREE.Mesh(new THREE.TubeGeometry(arch, 40, .035, 6, false), dark); group.add(canopyFrame);
    const rim = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arch.getPoints(70)), new THREE.LineBasicMaterial({ color: 0x74b8cc, transparent: true, opacity: .24 }));
    rim.position.z = -.035; group.add(rim);
    return group;
}

export function animateCraft(craft: any, time: number, boost = false) {
    const dt = Math.max(0, Math.min(.1, time - (craft.userData.animationTime ?? time)));
    craft.userData.animationTime = time;
    craft.userData.burner = (craft.userData.burner || 0) + (Number(boost) - (craft.userData.burner || 0)) * (1 - Math.exp(-(boost ? 18 : 5) * dt));
    const burner = craft.userData.burner;
    if (craft.userData.shield?.material.uniforms) craft.userData.shield.material.uniforms.time.value = time;
    for (const plume of craft.userData.exhausts || []) {
        plume.scale.y = (.8 + burner * 2.4) * (1 + Math.sin(time * 31 + plume.position.x) * .08);
        plume.scale.x = plume.scale.z = 1 + burner * .35;
        plume.position.z = plume.userData.nozzle - plume.userData.length * plume.scale.y * .5;
        plume.material.color.setRGB(.46 + burner * .54, .81 - burner * .20, 1 - burner * .72); plume.material.opacity = .45 + burner * .5;
    }
}

export class Airflow {
    geometry = new THREE.BufferGeometry();
    material = new THREE.LineBasicMaterial({ color: 0xa6daed, transparent: true, opacity: .25, depthWrite: false });
    lines: any;
    streaks: { x: number; y: number; z: number }[] = [];
    positions = new Float32Array(64 * 6);
    constructor(player: any) {
        for (let i = 0; i < 64; i++) {
            const angle = i * 2.399963, radius = 12 + (i * 17 % 23);
            this.streaks.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: -(i * 29 % 160) });
        }
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.lines = new THREE.LineSegments(this.geometry, this.material); this.lines.frustumCulled = false; player.add(this.lines); this.lines.visible = false;
    }
    update(dt: number, speed: number, active: boolean) {
        this.lines.visible = active; if (!active) return;
        this.material.opacity = .12 + Math.max(0, speed - 100) / 125 * .13;
        this.streaks.forEach((streak, i) => {
            streak.z += dt * speed * .8; if (streak.z > 12) streak.z -= 172;
            this.positions.set([streak.x, streak.y, streak.z, streak.x, streak.y, streak.z - 7 - speed * .035], i * 6);
        });
        this.geometry.attributes.position.needsUpdate = true;
    }
}
export function disposeObject(scene: any, object: any, keep: Set<any> = new Set()) {
    scene.remove(object); const resources = new Set<any>();
    object.traverse((child:any) => {
        if (child.geometry && !keep.has(child.geometry)) resources.add(child.geometry);
        for (const material of child.material ? Array.isArray(child.material) ? child.material : [child.material] : []) if (!keep.has(material)) resources.add(material);
    });
    resources.forEach(resource => resource.dispose());
}
export class Effects {
    scene: any;
    particles: any[] = [];
    rings: any[] = [];
    geometry = new THREE.PlaneGeometry(1, 1);
    ringGeometry = new THREE.TorusGeometry(1, 0.012, 4, 48);
    batch: any;
    matrix = new THREE.Matrix4();
    quaternion = new THREE.Quaternion();
    scale = new THREE.Vector3();
    color = new THREE.Color();
    dirty = false;
    constructor(scene: any) {
        this.scene = scene;
        this.batch = new THREE.InstancedMesh(this.geometry, new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            vertexShader: `varying vec2 vUv;varying vec3 vColor;void main(){vUv=uv;vColor=instanceColor;
            vec4 center=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);
            center.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*center;}`,
            fragmentShader: `precision mediump float;varying vec2 vUv;varying vec3 vColor;void main(){float r=length(vUv-.5)*2.0;
            float halo=pow(max(0.0,1.0-r),2.0);float core=1.0-smoothstep(.08,.24,r);gl_FragColor=vec4(mix(vColor,vec3(1.0,.94,.80),core*.7),halo*.8+core*.2);}`,
        }), 420);
        // This Three.js version allocates instance colors using the current draw count.
        this.batch.setColorAt(0, this.color);
        this.batch.count = 0; this.batch.frustumCulled = false; this.scene.add(this.batch);
    }
    burst(position: any, color: number, count = 20, large = false) {
        for (let i = 0; i < count && this.particles.length < 420; i++) {
            this.particles.push({ position: position.clone(), color,
                velocity: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar((large ? 110 : 55) * (0.4 + Math.random())),
                life: large ? 1.4 : 0.65, total: large ? 1.4 : 0.65, size: large ? 12 : 6 });
        }
        this.dirty = true;
    }
    ring(position: any, color: number, maxRadius: number, duration = 0.65, quaternion?: any) {
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false });
        const ring = new THREE.Mesh(this.ringGeometry, material); ring.position.copy(position);
        if (quaternion) ring.quaternion.copy(quaternion); else ring.rotation.x = -Math.PI / 2;
        ring.userData = { life: duration, total: duration, radius: maxRadius }; this.scene.add(ring); this.rings.push(ring);
    }
    update(dt: number) {
        if (this.particles.length) this.dirty = true;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i]; particle.life -= dt;
            particle.position.addScaledVector(particle.velocity, dt);
            particle.velocity.multiplyScalar(Math.exp(-1.2 * dt));
            if (particle.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const ring = this.rings[i], data = ring.userData; data.life -= dt;
            ring.scale.setScalar(1 + data.radius * (1 - data.life / data.total)); ring.material.opacity = Math.max(0, data.life / data.total) * 0.85;
            if (data.life <= 0) { this.scene.remove(ring); ring.material.dispose(); this.rings.splice(i, 1); }
        }
    }
    render() {
        if (!this.dirty) return;
        this.particles.forEach((particle, i) => {
            this.scale.setScalar(particle.size * Math.max(0, particle.life / particle.total));
            this.matrix.compose(particle.position, this.quaternion, this.scale);
            this.batch.setMatrixAt(i, this.matrix); this.batch.setColorAt(i, this.color.setHex(particle.color));
        });
        this.batch.count = this.particles.length; this.batch.instanceMatrix.needsUpdate = true;
        if (this.batch.instanceColor) this.batch.instanceColor.needsUpdate = true;
        this.dirty = false;
    }
    clear() {
        for (const ring of this.rings) { this.scene.remove(ring); ring.material.dispose(); }
        this.particles = []; this.rings = []; this.batch.count = 0; this.dirty = false;
    }
}
