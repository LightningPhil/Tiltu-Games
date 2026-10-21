/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import * as THREE from 'three';
import { segmentBoxFraction } from './flight.ts';
import { randomSource } from './game.ts';
import { Atmosphere } from './atmosphere.ts';
import type { VisualStyle } from './game.ts';

export interface Building { id: string; box: any; center: any; height: number }
type Chunk = { group: any; buildings: Building[]; bodies: any; details: any; edges: any; bounds: any };
const SIZE = 400;
const facadeVertex = `varying vec3 vWorld;varying vec3 vNormal;varying vec3 vTint;varying float vSeed;
void main(){vec4 world=modelMatrix*instanceMatrix*vec4(position,1.0);vWorld=world.xyz;
vNormal=normalize(mat3(modelMatrix)*normal);vTint=instanceColor;vSeed=instanceMatrix[3].x+instanceMatrix[3].z;
gl_Position=projectionMatrix*viewMatrix*world;}`;
const facadeFragment = `precision highp float;varying vec3 vWorld;varying vec3 vNormal;varying vec3 vTint;varying float vSeed;
uniform vec3 fogColor;uniform float fogDensity;uniform float retro;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
 float face=abs(vNormal.x)>.5?vWorld.z:vWorld.x;vec2 p=vec2(face/4.2,vWorld.y/5.8);vec2 f=fract(p);
 float distanceToEye=length(cameraPosition-vWorld);float aa=clamp(distanceToEye*.00009,.018,.18);
 float pane=smoothstep(.16-aa,.16+aa,f.x)*(1.0-smoothstep(.79-aa,.79+aa,f.x))*smoothstep(.22-aa,.22+aa,f.y)*(1.0-smoothstep(.70-aa,.70+aa,f.y));
 // Quantize the interpolated instance seed before hashing: tiny perspective rounding must not turn a room into animated noise.
 float seed=floor(vSeed+.5);float room=hash(floor(p)+seed*.17);float top=step(.5,vNormal.y);float light=dot(vNormal,normalize(vec3(-.4,.8,-.55)))*.5+.5;
 vec3 hull=mix(vec3(.018,.035,.070),vec3(.055,.075,.115),light);
 if(retro>.5){vec3 retroColor=vec3(.020,.032,.064)+vTint*.06*light;float haze=1.0-exp(-fogDensity*fogDensity*distanceToEye*distanceToEye);gl_FragColor=vec4(mix(retroColor,fogColor,haze),1.0);return;}
 vec3 windowColor=mix(vTint,vec3(1.0,.62,.28),step(.86,room));
 vec3 color=hull+windowColor*pane*step(.31,room)*(.28+room*.65)*(1.0-top);
 float band=1.0-smoothstep(.10,.30,abs(mod(vWorld.y+seed*.01,35.0)-1.0));color+=vTint*band*.20*(1.0-top);
 float fog=1.0-exp(-fogDensity*fogDensity*distanceToEye*distanceToEye);
 gl_FragColor=vec4(mix(color,fogColor,clamp(fog,0.0,1.0)),1.0);
}`;
const groundVertex = `varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
const groundFragment = `precision highp float;varying vec3 vWorld;uniform float time;uniform vec3 fogColor;uniform float fogDensity;uniform float retro;
float line(float x,float width,float aa){return 1.0-smoothstep(width-aa,width+aa,abs(x));}
void main(){
 vec2 p=vWorld.xz;vec2 cell=mod(p+50.0,100.0)-50.0;vec2 a=abs(cell);float dist=length(cameraPosition-vWorld);float aa=clamp(dist*.0006,.12,1.5);
 if(retro>.5){float grid=line(cell.x,.45,aa)+line(cell.y,.45,aa);vec3 retroColor=vec3(.007,.010,.025)+vec3(.11,.035,.20)*grid;float haze=1.0-exp(-fogDensity*fogDensity*dist*dist);gl_FragColor=vec4(mix(retroColor,fogColor,haze),1.0);return;}
 float road=1.0-smoothstep(15.0-aa,15.0+aa,min(a.x,a.y));vec3 color=mix(vec3(.025,.052,.075),vec3(.008,.019,.038),road);
 float paving=(line(mod(p.x,8.0)-4.0,.08,aa*.1)+line(mod(p.y,8.0)-4.0,.08,aa*.1))*(1.0-road);color+=vec3(.016,.030,.037)*paving;
 float curbs=(line(a.x-15.0,.35,aa)*step(17.0,a.y)+line(a.y-15.0,.35,aa)*step(17.0,a.x));color+=vec3(.035,.28,.34)*curbs;
 float dash=step(.3,fract((p.x+p.y)*.048));float center=(line(cell.x,.17,aa)*step(18.0,a.y)+line(cell.y,.17,aa)*step(18.0,a.x))*dash;color+=vec3(.42,.26,.12)*center;
 float lane=(line(a.x-7.0,.12,aa)*step(18.0,a.y)+line(a.y-7.0,.12,aa)*step(18.0,a.x));color+=vec3(.10,.18,.23)*lane;
 float carX=line(cell.x-5.0,.65,aa)*line(mod(p.y-time*24.0+floor(p.x/100.0)*31.0,97.0)-48.5,2.0,aa);
 float carZ=line(cell.y+5.0,.65,aa)*line(mod(p.x+time*20.0+floor(p.y/100.0)*19.0,113.0)-56.5,2.0,aa);color+=vec3(.65,.77,.90)*carX+vec3(.95,.16,.24)*carZ;
 float cross=(step(17.0,a.x)*step(a.x,23.0)*step(a.y,12.0)*step(.55,fract(p.y*.3))+step(17.0,a.y)*step(a.y,23.0)*step(a.x,12.0)*step(.55,fract(p.x*.3)));color+=vec3(.10,.15,.18)*cross;
 float reflection=exp(-abs(a.x-17.0)*.09)+exp(-abs(a.y-17.0)*.09);color+=vec3(.013,.047,.065)*reflection*(.5+.5*sin(p.x*.08+p.y*.13));
 float fog=1.0-exp(-fogDensity*fogDensity*dist*dist);gl_FragColor=vec4(mix(color,fogColor,clamp(fog,0.0,1.0)),1.0);
}`;

export class City {
    chunks = new Map<string, Chunk>();
    boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    floorGeometry = new THREE.PlaneGeometry(12000, 12000);
    bodyMaterial: any;
    detailMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff });
    edgeMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .66 });
    floorMaterial: any;
    atmosphere: Atmosphere;
    ground: any;
    frustum = new THREE.Frustum();
    projection = new THREE.Matrix4();
    cx = Infinity; cz = Infinity;
    scene: any; seed: number;
    visualStyle: VisualStyle;
    constructor(scene: any, seed: number, visualStyle: VisualStyle = 'neon') {
        this.scene = scene; this.seed = seed;
        this.visualStyle = visualStyle;
        const fog = { fogColor: { value: scene.fog?.color || new THREE.Color(0x252940) }, fogDensity: { value: .00072 } };
        this.bodyMaterial = new THREE.ShaderMaterial({ vertexShader: facadeVertex, fragmentShader: facadeFragment, uniforms: { ...fog, retro: { value: 0 } }, vertexColors: true });
        this.floorMaterial = new THREE.ShaderMaterial({ vertexShader: groundVertex, fragmentShader: groundFragment, uniforms: { ...fog, time: { value: 0 }, retro: { value: 0 } } });
        this.ground = new THREE.Mesh(this.floorGeometry, this.floorMaterial); this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -.2; scene.add(this.ground);
        this.atmosphere = new Atmosphere(scene, seed);
        this.setStyle(visualStyle);
    }
    setStyle(style: VisualStyle) {
        this.visualStyle = style; const retro = style === 'retro';
        this.bodyMaterial.uniforms.retro.value = this.floorMaterial.uniforms.retro.value = Number(retro);
        this.edgeMaterial.opacity = retro ? .95 : .66;
        this.edgeMaterial.color.setRGB(retro ? 2.2 : 1, retro ? 2.2 : 1, retro ? 2.2 : 1);
        this.atmosphere.setStyle(retro);
        for (const chunk of this.chunks.values()) chunk.details.visible = !retro;
    }
    update(position: any, elapsed = 0) {
        this.atmosphere.update(position, elapsed); this.floorMaterial.uniforms.time.value = elapsed;
        this.ground.position.x = position.x; this.ground.position.z = position.z;
        const cx = Math.floor(position.x / SIZE), cz = Math.floor(position.z / SIZE);if (this.cx === cx && this.cz === cz) return;
        this.cx = cx; this.cz = cz;const keep = new Set<string>();
        for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - 3; z <= cz + 3; z++) {
            const key = `${x},${z}`; keep.add(key);if (!this.chunks.has(key)) this.chunks.set(key, this.createChunk(x, z));
        }
        for (const [key, chunk] of this.chunks) if (!keep.has(key)) { this.removeChunk(chunk); this.chunks.delete(key); }
    }
    createChunk(cx: number, cz: number): Chunk {
        const rng = randomSource(this.seed ^ Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663));
        const group = new THREE.Group(), records: Building[] = [], positions: number[] = [], colors: number[] = [], tints: any[] = [];
        const details: { position: any; scale: any; color: any }[] = [];
        const addLine = (a: number[], b: number[], color: any, brightness = 1) => { positions.push(...a, ...b); for (let i = 0; i < 2; i++) colors.push(color.r * brightness, color.g * brightness, color.b * brightness); };
        const rect = (box: any, y: number, color: any, brightness = 1) => {
            const a = [box.min.x, y, box.min.z], b = [box.max.x, y, box.min.z], c = [box.max.x, y, box.max.z], d = [box.min.x, y, box.max.z];addLine(a, b, color, brightness);addLine(b, c, color, brightness);addLine(c, d, color, brightness);addLine(d, a, color, brightness);
        };
        const detail = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => details.push({ position: new THREE.Vector3(x, y, z), scale: new THREE.Vector3(w, h, d), color: new THREE.Color(color) });
        for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
            const width = 25 + rng() * 24, depth = 25 + rng() * 24,height = 32 + rng() ** 1.3 * 185 + (rng() < .06 ? 45 : 0);
            const px = cx * SIZE + x * 100 + 50, pz = cz * SIZE + z * 100 + 50;if (Math.abs(px) < 85 && pz < 160 && pz > -1100) continue;
            const color = new THREE.Color(rng() < .2 ? 0xbb78f4 : rng() < .14 ? 0xffbd74 : 0x5bc7e0);
            const style = Math.abs(cx * 3 + cz * 7 + x + z) % 4;
            const levels = height > 100 && style < 2 ? 3 : 1;
            let bottom = 0, box: any;
            for (let level = 0; level < levels; level++) {
                const top = level === levels - 1 ? height : height * (level === 0 ? .56 : .83);
                const inset = level === 0 ? 1 : level === 1 ? .77 : .53;
                box = new THREE.Box3(new THREE.Vector3(px - width * inset / 2, bottom, pz - depth * inset / 2), new THREE.Vector3(px + width * inset / 2, top, pz + depth * inset / 2));
                records.push({ id: `${cx},${cz}:${x},${z}:${level}`, box, center: box.getCenter(new THREE.Vector3()), height: top });
                tints.push(color); rect(box, top - .15, color, level === levels - 1 ? .9 : .42);
                for (const side of [-1, 1]) addLine([px + side * width * inset / 2, top, box.min.z], [px + side * width * inset / 2, bottom, box.min.z], color, .25);
                for (const side of [-1, 1]) addLine([px + side * width * inset / 2, top, box.max.z], [px + side * width * inset / 2, bottom, box.max.z], color, .25);
                bottom = top;
            }
            rect(box, height - Math.min(8, height * .1), color, .30);
            for (const side of [-1, 1]) {
                const roofWidth = box.max.x - box.min.x, roofDepth = box.max.z - box.min.z;
                detail(px + side * roofWidth * .23, height - 2, pz, roofWidth * .22, 4, roofDepth * .50, 0x12283b);
                detail(px + side * roofWidth * .23, height + .04, pz, roofWidth * .22, .10, roofDepth * .50, 0x29485c);
            }
            if (height > 150) {rect(box, height - 7, color, .8);detail(px, height + .12, pz, 2.2, .18, 2.2, 0xff5d87);}
            if (rng() < .24) {const front = records[records.length - levels].box, y = Math.min(front.max.y - 10, 32 + rng() * 45);detail(px, y, front.min.z - .08, width * .53, 6, .12, color.getHex());detail(px - width * .15, y, front.min.z - .16, width * .09, 4, .12, 0x091526);detail(px + width * .1, y, front.min.z - .16, width * .03, 4, .12, 0x091526);}
        }
        const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
        const bodies = new THREE.InstancedMesh(this.boxGeometry, this.bodyMaterial, records.length);
        records.forEach((building, i) => {scale.subVectors(building.box.max, building.box.min);matrix.compose(building.center, quaternion, scale);bodies.setMatrixAt(i, matrix);bodies.setColorAt(i, tints[i]);});
        bodies.instanceMatrix.needsUpdate = true;bodies.frustumCulled = false;group.add(bodies);
        const accessories = new THREE.InstancedMesh(this.boxGeometry, this.detailMaterial, details.length);
        details.forEach((part, i) => {matrix.compose(part.position, quaternion, part.scale);accessories.setMatrixAt(i, matrix);accessories.setColorAt(i, part.color);});accessories.frustumCulled = false;group.add(accessories);
        accessories.visible = this.visualStyle !== 'retro';
        const edges = new THREE.BufferGeometry();edges.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));edges.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));group.add(new THREE.LineSegments(edges, this.edgeMaterial));
        const bounds = new THREE.Box3(new THREE.Vector3(cx * SIZE, 0, cz * SIZE), new THREE.Vector3(cx * SIZE + SIZE, 300, cz * SIZE + SIZE));
        this.scene.add(group);return { group, buildings: records, bodies, details: accessories, edges, bounds };
    }
    cull(camera: any) {
        this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.projection);
        for (const chunk of this.chunks.values()) chunk.group.visible = this.frustum.intersectsBox(chunk.bounds);
    }
    query(start: any, end = start, padding = 0): Building[] {
        const result: Building[] = [];
        const minX = Math.floor((Math.min(start.x, end.x) - padding) / SIZE), maxX = Math.floor((Math.max(start.x, end.x) + padding) / SIZE);
        const minZ = Math.floor((Math.min(start.z, end.z) - padding) / SIZE), maxZ = Math.floor((Math.max(start.z, end.z) + padding) / SIZE);
        for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {const chunk = this.chunks.get(`${x},${z}`);if (chunk) result.push(...chunk.buildings);}return result;
    }
    segmentHit(start: any, end: any, padding = 0): { building: Building; fraction: number } | null {
        let result: { building: Building; fraction: number } | null = null;
        for (const building of this.query(start, end, padding)) {const fraction = segmentBoxFraction(start, end, building.box, padding);if (fraction !== null && (!result || fraction < result.fraction)) result = { building, fraction };}return result;
    }
    clear(start: any, end: any) { return this.segmentHit(start, end) === null; }
    clearance(start: any, end: any, padding: number, margin: number) {
        const a = { x: start.x, y: 1, z: start.z }, b = { x: end.x, y: 1, z: end.z }; let altitude = 0;
        for (const building of this.query(start, end, padding)) {
            const footprint = { min: { x: building.box.min.x, y: 0, z: building.box.min.z }, max: { x: building.box.max.x, y: 2, z: building.box.max.z } };
            if (segmentBoxFraction(a, b, footprint, padding) !== null) altitude = Math.max(altitude, building.height + margin);
        }
        return altitude;
    }
    removeChunk(chunk: Chunk) { this.scene.remove(chunk.group);chunk.bodies.dispose();chunk.details.dispose();chunk.edges.dispose(); }
    dispose() {
        for (const chunk of this.chunks.values()) this.removeChunk(chunk);this.chunks.clear();this.atmosphere.dispose();this.scene.remove(this.ground);
        for (const resource of [this.boxGeometry, this.floorGeometry, this.bodyMaterial, this.detailMaterial, this.edgeMaterial, this.floorMaterial]) resource.dispose();
    }
}

