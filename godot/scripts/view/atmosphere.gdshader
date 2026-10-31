shader_type canvas_item;
render_mode unshaded;
uniform float aspect=1.6;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void fragment(){
 vec2 p=UV*vec2(aspect,1.0);
 float n=noise(p*3.5+vec2(TIME*.012,-TIME*.007));
 float fine=noise(p*8.0-vec2(TIME*.019,0));
 float mist=smoothstep(.37,.88,n*.72+fine*.28)*.115;
 float edge=smoothstep(.28,.74,length((UV-.5)*vec2(1.05,1.0)));
 vec3 tint=mix(vec3(.48,.55,.64),vec3(.035,.048,.07),edge);
 COLOR=vec4(tint,mist+edge*.28);
}
