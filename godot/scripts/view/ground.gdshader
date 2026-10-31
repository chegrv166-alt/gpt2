shader_type canvas_item;
render_mode unshaded;
uniform sampler2D terrain : source_color, filter_linear, repeat_disable;
uniform vec2 board_size=vec2(1100.0,700.0);
uniform vec2 camera_pan=vec2(0.0);
uniform float camera_zoom=1.0;
uniform bool battle_mode=false;
uniform sampler2D region_mask : filter_linear, repeat_disable;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float segment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0));}
void fragment(){
 vec2 p=(UV*board_size-board_size*.5-camera_pan)/max(camera_zoom,.1);
 vec2 tile=vec2((p.x/32.0+p.y/16.0)*.5,(p.y/16.0-p.x/32.0)*.5);
 vec2 sample_uv=fract(tile/7.0)*.496+vec2(.002);
 vec3 earth=texture(terrain,sample_uv+vec2(.5,0)).rgb;
 vec3 stone=texture(terrain,sample_uv).rgb;
 vec4 geography=texture(region_mask,(tile+vec2(.5))/vec2(512.0,384.0));
 float wear=noise(tile*.75);
 float paving=geography.r;
 earth=mix(vec3(.145,.16,.18),earth*.65,.56);
 stone=mix(vec3(.21,.23,.25),stone*.85,.76);
 float urban=(1.0-smoothstep(.04,.09,abs(geography.b-.157)))+(1.0-smoothstep(.04,.09,abs(geography.b-.333)))+(1.0-smoothstep(.04,.09,abs(geography.b-.863)));
 stone=mix(earth*1.16,stone,clamp(urban,0.0,1.0));
 vec3 base=mix(earth,stone,paving);
 float river=geography.g;
 vec2 water_uv=vec2(sample_uv.x,sample_uv.y+sin(TIME*.12+tile.x*.2)*.001)+vec2(.5,.5);
 base=mix(base,texture(terrain,water_uv).rgb*.62,river);
 if(battle_mode){base=mix(vec3(.19,.21,.235),texture(terrain,sample_uv+vec2(0,.5)).rgb*.72,.75);}
 base*=mix(.86,1.12,noise(tile*.19));
 if(!battle_mode){
  float cliff=1.0-geography.a;
  vec3 stone_face=vec3(.11,.13,.15)*(.75+noise(tile*.65)*.45);
  float ledge=abs(geography.a-texture(region_mask,(tile+vec2(1.5,1.5))/vec2(512,384)).a);
  base=mix(base,stone_face,cliff);
  base+=vec3(.11,.10,.085)*ledge;
  base*=mix(vec3(.87,.96,.92),vec3(1.04,1.02,.97),smoothstep(.68,.9,geography.b));
  float fields=noise(tile*.035);
  base=mix(base,base*vec3(.84,.9,.78),smoothstep(.6,.8,fields)*(1.0-paving)*.35);
 }
 COLOR=vec4(base,1.0);
}
