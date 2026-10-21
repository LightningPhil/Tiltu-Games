/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import * as THREE from 'three';

const vertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
const blur = `precision mediump float;varying vec2 vUv;uniform sampler2D source;uniform vec2 direction;uniform float threshold;
void main(){vec3 c=texture2D(source,vUv).rgb*.227027;
c+=(texture2D(source,vUv+direction*1.384615).rgb+texture2D(source,vUv-direction*1.384615).rgb)*.316216;
c+=(texture2D(source,vUv+direction*3.230769).rgb+texture2D(source,vUv-direction*3.230769).rgb)*.070270;
if(threshold>0.0)c*=smoothstep(.36,.85,max(c.r,max(c.g,c.b)));gl_FragColor=vec4(c,1.0);}`;
const composite = `precision mediump float;varying vec2 vUv;uniform sampler2D source;uniform sampler2D glow;uniform float bloom;uniform float time;
void main(){vec3 c=texture2D(source,vUv).rgb;vec3 light=texture2D(glow,vUv).rgb;
c+=light*bloom;float edge=dot(vUv-.5,vUv-.5);c*=1.0-edge*.48;
c=pow(c,vec3(.91));gl_FragColor=vec4(c,1.0);}`;

/** Small, bounded bloom pipeline. Performance mode renders the scene directly. */
export class FlightRenderer {
    renderer: any;
    sceneTarget: any;
    blurA: any;
    blurB: any;
    scene = new THREE.Scene();
    camera = new THREE.Camera();
    quad: any;
    blurMaterial: any;
    compositeMaterial: any;
    quality: 'cinematic' | 'performance' = 'cinematic';
    retro = false;
    width = 1;
    height = 1;
    constructor(renderer: any) {
        this.renderer = renderer;
        renderer.info.autoReset = false;
        const options = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
        this.sceneTarget = new THREE.WebGLRenderTarget(1, 1, { ...options, depthBuffer: true });
        this.blurA = new THREE.WebGLRenderTarget(1, 1, options); this.blurB = new THREE.WebGLRenderTarget(1, 1, options);
        this.blurMaterial = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: blur, depthTest: false, depthWrite: false,
            uniforms: { source: { value: null }, direction: { value: new THREE.Vector2() }, threshold: { value: 0 } } });
        this.compositeMaterial = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: composite, depthTest: false, depthWrite: false,
            uniforms: { source: { value: null }, glow: { value: null }, bloom: { value: .5 }, time: { value: 0 } } });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMaterial); this.scene.add(this.quad);
    }
    resize(width: number, height: number, quality = this.quality) {
        this.quality = quality;
        const ratio = Math.min(devicePixelRatio || 1, quality === 'performance' ? 1 : 1.5);
        this.renderer.setPixelRatio(ratio); this.renderer.setSize(width, height);
        this.width = Math.max(1, Math.round(width * ratio)); this.height = Math.max(1, Math.round(height * ratio));
        this.sceneTarget.setSize(this.width, this.height);
        this.blurA.setSize(Math.max(1, Math.round(this.width / 4)), Math.max(1, Math.round(this.height / 4)));
        this.blurB.setSize(this.blurA.width, this.blurA.height);
    }
    render(scene: any, camera: any) {
        const renderer = this.renderer;
        renderer.info.reset();
        if (this.quality === 'performance' || this.retro) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
        renderer.setRenderTarget(this.sceneTarget); renderer.render(scene, camera);
        this.quad.material = this.blurMaterial;
        const u = this.blurMaterial.uniforms;
        u.source.value = this.sceneTarget.texture; u.threshold.value = 1; u.direction.value.set(1 / this.width, 1 / this.height);
        renderer.setRenderTarget(this.blurA); renderer.render(this.scene, this.camera);
        u.threshold.value = 0;
        for (let i = 0; i < 2; i++) {
            u.source.value = this.blurA.texture; u.direction.value.set((1.3 + i) / this.blurA.width, 0);
            renderer.setRenderTarget(this.blurB); renderer.render(this.scene, this.camera);
            u.source.value = this.blurB.texture; u.direction.value.set(0, (1.3 + i) / this.blurA.height);
            renderer.setRenderTarget(this.blurA); renderer.render(this.scene, this.camera);
        }
        this.quad.material = this.compositeMaterial;
        this.compositeMaterial.uniforms.source.value = this.sceneTarget.texture; this.compositeMaterial.uniforms.glow.value = this.blurA.texture;
        renderer.setRenderTarget(null); renderer.render(this.scene, this.camera);
    }
    dispose() {
        for (const resource of [this.sceneTarget, this.blurA, this.blurB, this.quad.geometry, this.blurMaterial, this.compositeMaterial]) resource.dispose();
    }
}
