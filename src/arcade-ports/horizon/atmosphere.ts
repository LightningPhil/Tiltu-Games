/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import * as THREE from 'three';
import { randomSource } from './game.ts';

const skyVertex = `varying vec3 vDirection;
void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const skyFragment = `
precision highp float;
uniform float time;
uniform float retro;
varying vec3 vDirection;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.01)*.12;}
void main(){
 vec3 d=normalize(vDirection);float h=max(d.y,0.0);
 vec3 sun=normalize(vec3(.24,.115,-1.0));float alignment=dot(d,sun);
 vec3 color=mix(vec3(.19,.16,.29),vec3(.012,.022,.075),smoothstep(0.0,.64,h));
 color=mix(vec3(.034,.066,.105),color,smoothstep(-.25,.025,d.y));
 float dusk=pow(max(alignment,0.0),7.0)*(1.0-smoothstep(.1,.58,h));
 color+=vec3(.39,.13,.13)*dusk;
 color+=vec3(.24,.075,.08)*pow(max(alignment,0.0),42.0);
 float disc=smoothstep(.995,.9953,alignment);
 float stripe=mix(step(.25,fract((d.y+.02)*85.0)),1.0,smoothstep(.105,.13,d.y));
 vec3 solar=mix(vec3(1.0,.23,.32),vec3(1.0,.85,.52),smoothstep(.02,.20,d.y));
 color=mix(color,solar,disc*stripe);
 if(retro>.5){vec3 simple=mix(vec3(.09,.035,.16),vec3(.005,.008,.035),smoothstep(0.0,.5,h));simple+=vec3(.16,.03,.07)*pow(max(alignment,0.0),14.0);gl_FragColor=vec4(mix(simple,solar,disc*stripe),1.0);return;}
 vec2 p=d.xz*5.0+vec2(d.y*11.0,time*.002);
 float cloud=fbm(p+fbm(p*1.9));
 float veil=smoothstep(.42,.76,cloud)*smoothstep(.015,.12,d.y)*(1.0-smoothstep(.26,.6,d.y));
 color+=mix(vec3(.12,.10,.23),vec3(.29,.13,.20),dusk)*veil*.65;
 // A quiet violet nebula overhead keeps every heading interesting.
 float nebula=pow(max(0.0,fbm(d.xz*4.0+vec2(h*8.0,2.0))-.36),2.0)*smoothstep(.12,.65,h);
 color+=vec3(.12,.055,.23)*nebula*2.4;
 gl_FragColor=vec4(color,1.0);
}`;

/** The sky and distant silhouettes travel with the pilot; streets retain world coordinates. */
export class Atmosphere {
    scene: any;
    sky: any;
    stars: any;
    mountains: any;
    skyline: any;
    constructor(scene: any, seed: number) {
        this.scene = scene;
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(3500, 40, 24), new THREE.ShaderMaterial({
            vertexShader: skyVertex, fragmentShader: skyFragment, uniforms: { time: { value: 0 }, retro: { value: 0 } },
            side: THREE.BackSide, depthWrite: false, fog: false,
        }));
        this.sky.renderOrder = -20; scene.add(this.sky);
        const rng = randomSource(seed ^ 0xc170), vertices: number[] = [], colors: number[] = [];
        for (let i = 0; i < 1100; i++) {
            const angle = rng() * Math.PI * 2, elevation = .06 + rng() * .94, radius = 3300;
            vertices.push(Math.cos(angle) * radius * Math.sqrt(1 - elevation ** 2), elevation * radius, Math.sin(angle) * radius * Math.sqrt(1 - elevation ** 2));
            const warmth = rng(), brightness = .35 + rng() * .65;
            colors.push(brightness * (.7 + warmth * .3), brightness * .8, brightness);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 2.9, vertexColors: true, transparent: true, opacity: .82, fog: false, depthWrite: false }));
        this.stars.renderOrder = -18; scene.add(this.stars);
        const positions: number[] = [];
        // Two continuous mountain ridges, with no collision geometry in the playable city.
        for (let layer = 0; layer < 2; layer++) {
            const radius = 2400 + layer * 500;
            const heights = Array.from({ length: 97 }, () => 30 + rng() ** 2 * (230 + layer * 150)); heights[96] = heights[0];
            for (let i = 0; i < 96; i++) {
                const a = i / 96 * Math.PI * 2, b = (i + 1) / 96 * Math.PI * 2;
                positions.push(Math.cos(a) * radius, -80, Math.sin(a) * radius, Math.cos(b) * radius, -80, Math.sin(b) * radius,
                    Math.cos(a) * radius, heights[i], Math.sin(a) * radius,
                    Math.cos(a) * radius, heights[i], Math.sin(a) * radius, Math.cos(b) * radius, -80, Math.sin(b) * radius,
                    Math.cos(b) * radius, heights[i + 1], Math.sin(b) * radius);
            }
        }
        const ridge = new THREE.BufferGeometry(); ridge.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.mountains = new THREE.Mesh(ridge, new THREE.MeshBasicMaterial({ color: 0x24283f, side: THREE.DoubleSide, fog: false }));
        this.mountains.renderOrder = -15; scene.add(this.mountains);
        this.skyline = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhongMaterial({ color: 0x223249, shininess: 0, flatShading: true }), 320);
        const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(), position = new THREE.Vector3();
        for (let i = 0; i < 320; i++) {
            const angle = i * 2.399963, radius = 1750 + rng() * 1100, height = 30 + rng() ** 1.6 * 200;
            position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius); scale.set(28 + rng() * 32, height, 28 + rng() * 32);
            matrix.compose(position, rotation, scale); this.skyline.setMatrixAt(i, matrix);
        }
        this.skyline.frustumCulled = false; scene.add(this.skyline);
    }
    update(position: any, elapsed = 0) {
        this.sky.position.copy(position); this.stars.position.copy(position);
        this.mountains.position.set(position.x, 0, position.z);
        this.skyline.position.set(position.x, 0, position.z);
        this.sky.material.uniforms.time.value = elapsed;
    }
    setStyle(retro: boolean) {
        this.sky.material.uniforms.retro.value = Number(retro);
        this.stars.geometry.setDrawRange(0, retro ? 260 : 1100);
        this.mountains.material.color.setHex(retro ? 0x17112d : 0x24283f);
        this.skyline.material.color.setHex(retro ? 0x090e22 : 0x223249);
    }
    dispose() {
        this.skyline.dispose();
        for (const object of [this.sky, this.stars, this.mountains, this.skyline]) {
            this.scene.remove(object); object.geometry.dispose(); object.material.dispose();
        }
    }
}
