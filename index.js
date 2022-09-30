import * as THREE from 'three';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import metaversefile from 'metaversefile';


const {useApp, useFrame, useLoaders, usePhysics, useCleanup, useLocalPlayer, useActivat, useInternals} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\/]*$/, '$1'); 
const textureLoader = new THREE.TextureLoader();
const splashTexture = textureLoader.load(`${baseUrl}/textures/splash.png`);
const splashTexture2 = textureLoader.load(`${baseUrl}/textures/splash.png`);
splashTexture2.wrapS = splashTexture2.wrapT = THREE.RepeatWrapping;



export default () => {  
    const scene = useInternals().sceneLowPriority;
    const camera = useInternals().camera;
    const app = useApp();
    let mesh = null;

    const _getGeometry = (geometry, attributeSpecs, particleCount) => {
        const geometry2 = new THREE.BufferGeometry();
        ['position', 'normal', 'uv'].forEach(k => {
            geometry2.setAttribute(k, geometry.attributes[k]);
        });
        geometry2.setIndex(geometry.index);
    
        const positions = new Float32Array(particleCount * 3);
        const positionsAttribute = new THREE.InstancedBufferAttribute(positions, 3);
        geometry2.setAttribute('positions', positionsAttribute);
    
        for(const attributeSpec of attributeSpecs){
            const {
                name,
                itemSize,
            } = attributeSpec;
            const array = new Float32Array(particleCount * itemSize);
            geometry2.setAttribute(name, new THREE.InstancedBufferAttribute(array, itemSize));
        }
    
        return geometry2;
    };

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: {
                value: 0,
            },
            splashTexture: {
                value: splashTexture
            },
            splashTexture2: {
                value: splashTexture2
            },
            cameraBillboardQuaternion: {
                value: new THREE.Quaternion(),
            }
        },
        vertexShader: `\
            ${THREE.ShaderChunk.common}
            ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
            uniform float uTime;
            uniform vec4 cameraBillboardQuaternion;
                
            attribute float scales;
            attribute float broken;
            attribute float opacity;
            attribute vec3 positions;
            attribute vec4 quaternions;
            attribute float distortionScaleX;
            attribute float distortionScaleY;
            attribute float rotationY;

            varying float vBroken;
            varying vec2 vUv;
            varying float vOpacity;
            varying float vDistortionScaleX;
            varying float vDistortionScaleY;

            vec3 rotateVecQuat(vec3 position, vec4 q) {
                vec3 v = position.xyz;
                return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
            }

            void main() { 
                mat3 rotY = mat3(
                    cos(rotationY), 0.0, -sin(rotationY), 
                    0.0, 1.0, 0.0, 
                    sin(rotationY), 0.0, cos(rotationY)
                ); 
                vDistortionScaleX = distortionScaleX;
                vDistortionScaleY = distortionScaleY;
                vOpacity = opacity;
                vBroken = broken;
                vUv = uv;
                vec3 pos = position;
                // pos = rotateVecQuat(pos, quaternions);
                pos *= scales;
                pos *= 0.01;
                pos *= rotY;
                pos += positions;
                vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
                vec4 viewPosition = viewMatrix * modelPosition;
                vec4 projectionPosition = projectionMatrix * viewPosition;
                gl_Position = projectionPosition;
                ${THREE.ShaderChunk.logdepthbuf_vertex}
            }
        `,
        fragmentShader: `\
            ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
            uniform float uTime;
            uniform sampler2D splashTexture;
            uniform sampler2D splashTexture2;
            
            varying float vDistortionScaleX;
            varying float vDistortionScaleY;
            varying vec2 vUv;
            varying vec3 vPos;
            varying float vOpacity;
            void main() {
                
                vec4 splash = texture2D(splashTexture, vec2(vUv.x, vUv.y));
                vec4 splash2 = texture2D(splashTexture2, vec2(vUv.x * 2.0, vUv.y * 2.0 + uTime));
                float distortionX = splash.g * vDistortionScaleX;
                float distortionY = splash2.r * vDistortionScaleY;
                 
                vec2 distortion = vec2(distortionX, distortionY);
                vec4 splash3 = texture2D(splashTexture, vUv + distortion);
                float op = floor(splash2.r * vOpacity + 0.5) * splash3.b;
                gl_FragColor = vec4(1.0, 1.0, 1.0, splash3.b) * vec4(1.0, 0., 0., 1.0) * clamp(splash2.r, 0.2, 1.0);
                gl_FragColor.a *= op;
                
            ${THREE.ShaderChunk.logdepthbuf_fragment}
            }
        `,
        transparent: true,
        depthWrite: false,
        // blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    const particleCount = 5;
    (async () => {
        const u = `${baseUrl}/assets/splash2.glb`;
        const splash = await new Promise((accept, reject) => {
            const {gltfLoader} = useLoaders();
            gltfLoader.load(u, accept, function onprogress() {}, reject);
            
        });
        
        splash.scene.traverse(o => {
        if (o.isMesh) {
            const splashGeometry = o.geometry;
            const attributeSpecs = [];
            attributeSpecs.push({name: 'broken', itemSize: 1});
            attributeSpecs.push({name: 'rotationY', itemSize: 1});
            attributeSpecs.push({name: 'opacity', itemSize: 1});
            attributeSpecs.push({name: 'scales', itemSize: 1});
            attributeSpecs.push({name: 'distortionScaleX', itemSize: 1});
            attributeSpecs.push({name: 'distortionScaleY', itemSize: 1});
            

            const geometry = _getGeometry(splashGeometry, attributeSpecs, particleCount);
            const quaternions = new Float32Array(particleCount * 4);
            const identityQuaternion = new THREE.Quaternion();
            for (let i = 0; i < particleCount; i++) {
                identityQuaternion.toArray(quaternions, i * 4);
            }
            const quaternionsAttribute = new THREE.InstancedBufferAttribute(quaternions, 4);
            geometry.setAttribute('quaternions', quaternionsAttribute);
           
            mesh = new THREE.InstancedMesh(geometry, material, particleCount);
            scene.add(mesh);
        }
        });
    })();
    
    
    
    
    useFrame(({timestamp}) => {
        if (mesh) {
            const positionsAttribute = mesh.geometry.getAttribute('positions');
            const scalesAttribute = mesh.geometry.getAttribute('scales');
            const opacityAttribute = mesh.geometry.getAttribute('opacity');
            const distortionScaleXAttribute = mesh.geometry.getAttribute('distortionScaleX');
            const distortionScaleYAttribute = mesh.geometry.getAttribute('distortionScaleY');
            const rotYAttribute = mesh.geometry.getAttribute('rotationY');
            let count = 0;
            for (let i = 0; i < particleCount; i ++) {
                if (opacityAttribute.getX(i) <= 0.05) {
                    positionsAttribute.setXYZ(i, 0, 1.0, 0);
                    opacityAttribute.setX(i, 10.0);
                    scalesAttribute.setXYZ(i, 0.2);
                    distortionScaleXAttribute.setX(i, Math.random() * 0.1);
                    distortionScaleYAttribute.setX(i, Math.random() * 0.1);
                    rotYAttribute.setX(i, Math.random() * 2 * Math.PI);
                    count ++;
                }
                if (count > 2) {
                    break;
                }
            }
            for (let i = 0; i < particleCount; i ++) {
                if (distortionScaleXAttribute.getX(i) > 0.8 || distortionScaleYAttribute.getX(i) > 0.8) {
                    // opacityAttribute.setX(i, 0);
                    // opacityAttribute.setX(i, opacityAttribute.getX(i) - 0.02);
                }
                opacityAttribute.setX(i, opacityAttribute.getX(i) / 1.02);
                distortionScaleXAttribute.setX(i, distortionScaleXAttribute.getX(i) * 1.02);
                distortionScaleYAttribute.setX(i, distortionScaleYAttribute.getX(i) * 1.02);
                scalesAttribute.setX(i, scalesAttribute.getX(i) + 0.002);
            }

            material.uniforms.uTime.value = timestamp / 1000;
            // material.uniforms.cameraBillboardQuaternion.value.copy(camera.quaternion);

            positionsAttribute.needsUpdate = true;
            scalesAttribute.needsUpdate = true;
            opacityAttribute.needsUpdate = true;
            distortionScaleXAttribute.needsUpdate = true;
            distortionScaleYAttribute.needsUpdate = true;
            rotYAttribute.needsUpdate = true;
        }
            
        scene.updateMatrixWorld();
        
    });

    return app;
}