"""Author the office's reusable stylized adult character parts, without downloads.

Run: blender --background --python scripts/art/build_characters.py
Coordinates below are character-local x/right, y/up, z/forward. Parts retain the
same joint origins as Character.tsx; Blender's glTF exporter handles Y-up.
"""

import math
import os
import sys
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(__file__))
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=.68):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    return m


M = {name: material(name, color, rough) for name, color, rough in [
    ("skin", (.68, .39, .24), .63), ("skin_warm", (.64, .30, .21), .66),
    ("lips", (.43, .19, .14), .67), ("mouth", (.16, .065, .045), .73),
    ("shirt", (.18, .29, .20), .89), ("shirt_shadow", (.12, .20, .13), .92),
    ("accent", (.78, .75, .67), .94), ("pants", (.20, .23, .24), .89),
    ("pants_shadow", (.13, .15, .16), .94), ("hair", (.12, .064, .036), .78),
    ("hair_highlight", (.18, .10, .048), .81), ("eye_white", (.90, .87, .80), .40),
    ("iris", (.13, .07, .037), .35), ("pupil", (.012, .010, .009), .30),
    ("glint", (1, .96, .87), .15), ("shoe", (.14, .15, .14), .69),
    ("sole", (.65, .62, .54), .87), ("metal", (.24, .23, .19), .36),
    ("lens", (.59, .70, .68), .20), ("headphones", (.075, .085, .075), .62),
]}


M["beard_stubble"]=material("beard_stubble",(.28,.18,.12),.95)
M["beard_short"]=material("beard_short",(.16,.09,.05),.93)

def coord(p):
    return (p[0], -p[2], p[1])


def mesh(name, verts, faces, mat="skin"):
    data = bpy.data.meshes.new(name)
    data.from_pydata([coord(p) for p in verts], [], faces)
    data.materials.append(M[mat])
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    for poly in data.polygons:
        poly.use_smooth = True
    return ob


def merge(name, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = name
    return objects[0]


def loft(name, rings, mat, segments=32):
    # rings: y, width, depth, z offset. Elliptical sections are deliberately
    # varied along each garment to give a cut waist, shoulders and fabric folds.
    verts, faces = [], []
    for j, ring in enumerate(rings):
        y, rx, rz, z = ring
        for i in range(segments):
            a = i * math.tau / segments
            fold = 1 + .012 * math.sin(a * 5 + j * .8)
            verts.append((math.sin(a) * rx * fold, y, z + math.cos(a) * rz * fold))
    for j in range(len(rings) - 1):
        for i in range(segments):
            a = j * segments + i
            b = j * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.append(tuple(range(segments - 1, -1, -1)))
    faces.append(tuple((len(rings) - 1) * segments + i for i in range(segments)))
    if rings[-1][0] < rings[0][0]:
        faces = [tuple(reversed(face)) for face in faces]
    return mesh(name, verts, faces, mat)


def tube(name, points, radii, mat, sides=8):
    verts, faces = [], []
    for i, p in enumerate(points):
        tangent = Vector(points[min(i + 1, len(points)-1)]) - Vector(points[max(0, i-1)])
        tangent.normalize()
        axis = tangent.cross(Vector((0, 0, 1)))
        if axis.length < .01:
            axis = tangent.cross(Vector((0, 1, 0)))
        axis.normalize()
        other = tangent.cross(axis).normalized()
        r = radii[i] if isinstance(radii, (tuple, list)) else radii
        for k in range(sides):
            a = k * math.tau / sides
            verts.append(tuple(Vector(p) + r * (math.cos(a) * axis + math.sin(a) * other)))
    for i in range(len(points)-1):
        for k in range(sides):
            a=i*sides+k; b=i*sides+(k+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(range(sides-1,-1,-1)))
    faces.append(tuple((len(points)-1)*sides+k for k in range(sides)))
    return mesh(name, verts, faces, mat)


def ellipsoid(name, center, scale, mat, seg=20, rings=12):
    verts, faces=[],[]
    for j in range(rings+1):
        phi=math.pi*j/rings
        for i in range(seg):
            a=math.tau*i/seg
            verts.append((center[0]+scale[0]*math.sin(phi)*math.cos(a),center[1]+scale[1]*math.cos(phi),center[2]+scale[2]*math.sin(phi)*math.sin(a)))
    for j in range(rings):
        for i in range(seg):
            a=j*seg+i;b=j*seg+(i+1)%seg
            faces.append((a,b,b+seg,a+seg))
    return mesh(name,verts,faces,mat)


def gaussian(x, center, width):
    return math.exp(-((x-center)/width)**2/2)


# Continuous facial surface: a shaped jaw and chin, cheek planes, brow ridge,
# sockets, nasal bridge, nasal tip and nostril wings all share one mesh.
profile = [(-.275,.026,.065,.067),(-.257,.078,.097,.092),(-.232,.119,.123,.120),
    (-.20,.153,.139,.145),(-.16,.179,.151,.166),(-.12,.195,.160,.180),
    (-.08,.205,.168,.188),(-.04,.209,.173,.192),(0,.208,.174,.194),
    (.04,.207,.171,.193),(.08,.205,.168,.190),(.12,.200,.166,.184),
    (.16,.193,.159,.175),(.20,.177,.147,.159),(.235,.148,.124,.134),
    (.265,.104,.087,.094),(.285,.049,.042,.045),(.293,.004,.004,.004)]
def face_depth(x, y):
    n = next((i for i in range(len(profile)-1) if profile[i+1][0] >= y), len(profile)-2)
    t = (y-profile[n][0])/(profile[n+1][0]-profile[n][0])
    rx, zf = [profile[n][k]*(1-t)+profile[n+1][k]*t for k in (1,2)]
    c = math.sqrt(max(0, 1-(x/rx)**2))
    nose=.036*gaussian(x,0,.023)*gaussian(y,.006,.060)+.058*gaussian(x,0,.027)*gaussian(y,-.061,.025)
    nose+=.021*(gaussian(x,-.029,.013)+gaussian(x,.029,.013))*gaussian(y,-.077,.015)
    cheeks=.013*(gaussian(x,-.123,.04)+gaussian(x,.123,.04))*gaussian(y,-.078,.038)
    sockets=-.009*(gaussian(x,-.089,.042)+gaussian(x,.089,.042))*gaussian(y,.014,.024)
    brow=.010*(gaussian(x,-.092,.048)+gaussian(x,.092,.048))*gaussian(y,.067,.018)
    muzzle=.009*gaussian(x,0,.075)*gaussian(y,-.147,.024)
    return c*zf+c**9*(nose+cheeks+sockets+brow+muzzle)


verts, faces=[],[]
samples=48
# Interpolate the profile into many rings; this preserves facial planes while
# smooth normals avoid the inflated sphere silhouette of the previous avatar.
for j in range(37):
    y=profile[0][0]+(profile[-1][0]-profile[0][0])*j/36
    n=next((i for i in range(len(profile)-1) if profile[i+1][0]>=y),len(profile)-2)
    t=(y-profile[n][0])/(profile[n+1][0]-profile[n][0])
    rx,zf,zb=[profile[n][k]*(1-t)+profile[n+1][k]*t for k in (1,2,3)]
    for i in range(samples):
        a=math.tau*i/samples
        x=math.sin(a)*rx;c=math.cos(a)
        z=c*(zf if c>0 else zb)
        front=max(c,0)**9
        nose=.036*gaussian(x,0,.023)*gaussian(y,.006,.060)+.058*gaussian(x,0,.027)*gaussian(y,-.061,.025)
        nose+=.021*(gaussian(x,-.029,.013)+gaussian(x,.029,.013))*gaussian(y,-.077,.015)
        cheeks=.013*(gaussian(x,-.123,.04)+gaussian(x,.123,.04))*gaussian(y,-.078,.038)
        sockets=-.009*(gaussian(x,-.089,.042)+gaussian(x,.089,.042))*gaussian(y,.014,.024)
        brow=.010*(gaussian(x,-.092,.048)+gaussian(x,.092,.048))*gaussian(y,.067,.018)
        muzzle=.009*gaussian(x,0,.075)*gaussian(y,-.147,.024)
        z+=front*(nose+cheeks+sockets+brow+muzzle)
        verts.append((x,y,z))
for j in range(36):
    for i in range(samples):
        a=j*samples+i;b=j*samples+(i+1)%samples
        faces.append((a,b,b+samples,a+samples))
faces.extend([tuple(range(samples-1,-1,-1)),tuple(36*samples+i for i in range(samples))])
mesh("face",verts,faces)

# Ear cartilage is a shaped shell with a recessed concha and curled helix.
ear_parts=[]
for s in (-1,1):
    v,f=[],[]
    for j in range(4):
        r=j/3
        for i in range(16):
            a=i*math.tau/16
            v.append((s*(.205+.030*math.sin(a)*r),-.028+.063*math.cos(a)*r,.006+.032*r+.006*math.cos(a)))
    for j in range(3):
        for i in range(16):
            a=j*16+i;b=j*16+(i+1)%16;f.append((a,b,b+16,a+16))
    ear_parts.append(mesh("ear_shell",v,f))
    pts=[(s*(.205+.030*math.sin(i*math.tau/20)),-.028+.063*math.cos(i*math.tau/20),.043+.006*math.cos(i*math.tau/20)) for i in range(21)]
    ear_parts.append(tube("ear_rim",pts,.006,"skin",6))
    ear_parts.append(tube("ear_fold",[(s*.213,-.006,.045),(s*.215,-.021,.050),(s*.214,-.043,.043)],[.004,.006,.003],"skin_warm"))
merge("ears",ear_parts)

eye_parts=[];lid_parts=[];brow_parts=[]

def eye_depth(x, y, cx):
    u=(x-cx)/.043
    v=(y-.014)/.021
    return face_depth(x,y)+.002+.010*max(0,1-u*u)*max(0,1-v*v)


def eye_disc(name, cx, cy, rx, ry, mat, lift, segments=18):
    verts,faces=[],[]
    for j in range(5):
        r=j/4
        for i in range(segments):
            a=math.tau*i/segments
            x=cx+rx*r*math.cos(a);y=cy+ry*r*math.sin(a)
            verts.append((x,y,eye_depth(x,y,cx)+lift+.0015*(1-r*r)))
    for j in range(4):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            faces.append((a,a+segments,b+segments,b))
    return mesh(name,verts,faces,mat)


for s in (-1,1):
    cx=s*.089
    v,f=[],[]
    for j in range(7):
        t=j/6
        for i in range(17):
            u=-1+i/8
            h=max(0,1-u*u)**.65
            x=cx+u*.043
            y=.014+(-.012*(1-t)+.020*t)*h+s*u*.003
            v.append((x,y,eye_depth(x,y,cx)))
    for j in range(6):
        for i in range(16):
            a=j*17+i;f.append((a,a+1,a+18,a+17))
    eye_parts.append(mesh("sclera",v,f,"eye_white"))
    eye_parts.append(eye_disc("iris",cx,.015,.016,.017,"iris",.0015))
    eye_parts.append(eye_disc("pupil",cx,.015,.008,.010,"pupil",.003,14))
    x,y=cx-.004,.021
    eye_parts.append(ellipsoid("catchlight",(x,y,eye_depth(x,y,cx)+.006),(.003,.003,.001),"glint",8,4))
    for upper in (True,False):
        pts=[]
        for i in range(17):
            u=-1+i/8;h=max(0,1-u*u)**.65
            x=cx+u*.044
            y=.014+(.021 if upper else -.013)*h+s*u*.003
            pts.append((x,y,face_depth(x,y)+.003))
        lid_parts.append(tube("eyelid",pts,[.002+(.005 if upper else .003)*math.sin(math.pi*i/16)**.5 for i in range(17)],"skin",6))
        if upper:
            lid_parts.append(tube("lashline",[(x,y-.001,z+.004) for x,y,z in pts],.0015,"hair",4))
            crease=[(x,y+.011,z-.003) for x,y,z in pts[2:-2]]
            lid_parts.append(tube("lid_crease",crease,.0012,"skin_warm",4))
    pts=[]
    for i in range(13):
        u=-1+i/6
        x=cx+u*.048;y=.074+.011*(1-u*u)-s*u*.005
        pts.append((x,y,face_depth(x,y)+.004))
    brow_parts.append(tube("brow",pts,[.0015+.005*math.sin(math.pi*i/12)**.45 for i in range(13)],"hair",6))
merge("eyes",eye_parts);merge("eyelids",lid_parts);merge("brows",brow_parts)

# Subtle modeled lips with cupid's bow and a relaxed smile, plus nasal crease.
mouth_parts=[]
for upper in (True,False):
    pts=[];rad=[]
    for i in range(17):
        u=-1+i/8
        base=-.152+.010*abs(u)**1.8
        lip=(.004+ .002*math.cos(u*math.pi*2)) if upper else -.005
        pts.append((u*.057,base+lip*(1-u*u),.164+.004*(1-u*u)))
        rad.append(.0007+(.0035 if upper else .0045)*math.sin(math.pi*i/16))
    mouth_parts.append(tube("lip",pts,rad,"lips",6))
pts=[(u*.057,-.152+.010*abs(u)**1.8,.169) for u in [-1+i/8 for i in range(17)]]
mouth_parts.append(tube("smile",pts,.0014,"mouth",4))
for s in (-1,1):
    mouth_parts.append(tube("nostril",[(s*.016,-.083,.222),(s*.024,-.084,.219),(s*.031,-.080,.211)],.0018,"skin_warm",6))
merge("mouth",mouth_parts)

loft("neck",[(.655,.079,.071,-.010),(.70,.073,.066,-.009),(.75,.071,.065,-.008),(.80,.080,.067,-.005)],"skin",28)
loft("torso",[(.025,.185,.122,0),(.055,.215,.142,0),(.10,.214,.145,0),(.16,.205,.143,0),(.26,.197,.138,0),(.36,.207,.148,-.002),(.46,.236,.159,-.004),(.54,.263,.151,-.006),(.59,.259,.137,-.006),(.63,.223,.119,-.004),(.675,.105,.080,0),(.69,.096,.077,0)],"shirt",40)
loft("pelvis",[(-.168,.107,.075,0),(-.145,.151,.102,0),(-.095,.184,.122,0),(-.035,.202,.130,0),(.025,.202,.129,0),(.077,.183,.114,0)],"pants",32)

# Tee inset, folded collar points and sewn plackets read as tailored layers.
def torso_front(x,y):
    shape=[(.025,.185,.122),(.055,.215,.142),(.10,.214,.145),(.16,.205,.143),(.26,.197,.138),(.36,.207,.148),(.46,.236,.159),(.54,.263,.151),(.59,.259,.137),(.63,.223,.119),(.675,.105,.080),(.69,.096,.077)]
    n=next((i for i in range(len(shape)-1) if shape[i+1][0]>=y),len(shape)-2)
    t=(y-shape[n][0])/(shape[n+1][0]-shape[n][0]);rx=shape[n][1]*(1-t)+shape[n+1][1]*t;rz=shape[n][2]*(1-t)+shape[n+1][2]*t
    return rz*math.sqrt(max(0,1-(x/rx)**2))+.006

v,f=[],[]
for j in range(11):
    t=j/10
    for i in range(13):
        u=-1+i/6
        width=.065*(1-t)+.072*t
        x=u*width
        top=.660-.028*math.sqrt(max(0,1-u*u))
        y=.045*(1-t)+top*t
        v.append((x,y,torso_front(x,y)))
for j in range(10):
    for i in range(12):
        a=j*13+i;f.append((a,a+1,a+14,a+13))
tee=mesh("tee",v,f,"accent")
# A narrow self-fabric neckline follows the same curved scoop.
pts=[]
for i in range(17):
    u=-1+i/8;x=.072*u;y=.660-.028*math.sqrt(max(0,1-u*u))
    pts.append((x,y,torso_front(x,y)+.002))
merge("tee",[tee,tube("tee_neckline",pts,.004,"accent",6)])
collar=[]
for s in (-1,1):
    v=[(s*.065,.672,.086),(s*.116,.651,.106),(s*.151,.596,.132),(s*.101,.529,.168),(s*.078,.602,.153)]
    ob=mesh("collar",v,[(0,1,2,4),(2,3,4)],"shirt")
    mod=ob.modifiers.new("Collar thickness","SOLIDIFY");mod.thickness=.006
    bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=ob.modifiers.new("Soft collar edge","BEVEL");mod.width=.004;mod.segments=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    collar.append(ob)
merge("collar",collar)
details=[]
# The inner tee tucks beneath a shaped front hem, so its lower edge never reads
# as a floating rectangle pasted onto the jacket.
v,f=[],[]
for j,(y,width) in enumerate([(.028,.185),(.055,.215),(.082,.214)]):
    for i in range(21):
        x=width*(-.98+i*.098)
        v.append((x,y,torso_front(x,y)+.003))
for j in range(2):
    for i in range(20):
        a=j*21+i;f.append((a,a+1,a+22,a+21))
details.append(mesh("front_hem",v,f,"shirt"))
for s in (-1,1):
    details.append(tube("placket",[(s*.077,.13,.152),(s*.079,.31,.160),(s*.090,.47,.171),(s*.101,.53,.166)],.004,"shirt_shadow",6))
    # Welt pocket and a quiet seam along each side.
    details.append(tube("pocket",[(s*.135,.452,.156),(s*.192,.439,.146)],.003,"shirt_shadow",6))
    details.append(tube("hem",[(s*.17,.07,.092),(s*.11,.065,.135),(s*.025,.064,.146)],.002,"shirt_shadow",6))
for y,z in [(.19,.155),(.30,.161),(.41,.171),(.51,.173)]:
    details.append(ellipsoid("button",(.091,y,z),(.005,.005,.003),"metal",8,4))
merge("torso_details",details)

# Cloth-shaped, articulated limb sections retain overlapping joint coverage.
loft("thigh",[(.024,.093,.103,0),(0,.101,.106,0),(-.045,.105,.105,0),(-.11,.100,.100,.002),(-.20,.087,.087,.002),(-.265,.080,.081,.001),(-.302,.077,.079,0),(-.320,.069,.070,0)],"pants",28)
loft("shin",[(.018,.078,.080,0),(-.015,.082,.081,.003),(-.060,.077,.075,.002),(-.14,.068,.065,0),(-.21,.061,.059,0),(-.247,.064,.063,.002),(-.262,.061,.060,.001)],"pants",28)
loft("upperarm",[(.035,.052,.057,0),(.012,.075,.079,0),(-.025,.082,.084,0),(-.08,.075,.077,0),(-.15,.069,.070,0),(-.215,.064,.065,0),(-.253,.065,.065,0),(-.270,.062,.063,0),(-.282,.058,.060,0)],"shirt",24)
loft("forearm_sleeve",[(.024,.062,.063,0),(-.015,.065,.065,0),(-.055,.065,.063,0),(-.115,.058,.056,0),(-.175,.049,.047,0),(-.208,.047,.046,0),(-.222,.050,.049,0),(-.236,.048,.047,0)],"shirt",24)
loft("forearm_bare",[(.020,.058,.058,0),(-.02,.059,.059,0),(-.07,.054,.055,0),(-.13,.045,.046,0),(-.20,.034,.036,0),(-.236,.032,.034,0)],"skin",24)
loft("cuff",[(-.204,.049,.048,0),(-.208,.052,.051,0),(-.234,.052,.050,0),(-.239,.047,.046,0)],"shirt_shadow",24)

# The relaxed hand is retained for idle/typing. Interaction hands share the
# elbow origin and continuous wrist, but have authored curled fingers rather
# than letting a straight fingertip penetrate the face or espresso machine.
def build_hand(name, pose):
    parts=[loft("palm",[(-.222,.030,.030,0),(-.244,.038,.030,.001),(-.273,.041,.026,.006),(-.295,.038,.024,.008),(-.305,.029,.020,.010)],"skin",20)]
    for i in range(4):
        x=-.026+i*.018
        if pose=="rest" or (pose=="point" and i==0):
            length=.062 if pose=="point" else [.050,.062,.057,.044][i]
            pts=[(x,-.286,.011),(x,-.308,.015),(x,-.308-length*.5,.021),(x+.002,-.308-length,.028)]
            if pose=="point":
                # The named reach axis passes through the actual index tip.
                pts=[(x,-.286,.011),(x*.5,-.308,.008),(0,-.340,.003),(0,-.370,0)]
            radii=[.010,.009,.008,.0045]
        else:
            # Knuckle, first bend, fingertip curling around the handle/pen.
            pts=[(x,-.283,.012),(x,-.312,.025),(x,-.315,.050),(x,-.294,.060),(x,-.280,.046)]
            radii=[.010,.010,.009,.007,.0045]
        parts.append(tube("finger",pts,radii,"skin",8))
    thumb=[(-.027,-.250,.012),(-.048,-.266,.018),(-.056,-.284,.029),(-.055,-.295,.041)] if pose=="rest" else [(-.027,-.250,.012),(-.047,-.269,.032),(-.037,-.285,.055),(-.016,-.287,.060)]
    parts.append(tube("thumb",thumb,[.017,.014,.010,.006],"skin",10))
    hand=merge(name,parts)
    mod=hand.modifiers.new("Continuous hand","REMESH");mod.mode="VOXEL";mod.voxel_size=.0035;mod.use_smooth_shade=True
    bpy.context.view_layer.objects.active=hand;bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=hand.modifiers.new("Natural palm","SMOOTH");mod.factor=.7;mod.iterations=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=hand.modifiers.new("Hand economy","DECIMATE");mod.ratio=.13
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return hand
build_hand("hand","rest")
build_hand("hand_grip","grip")
build_hand("hand_point","point")

# Shoes are horizontal lofts with a raised heel, tapered toe, welt and sole.
def shoe_section(name, sole=False):
    v,f=[],[]
    sections=[(-.085,.043),(-.06,.069),(0,.077),(.075,.078),(.145,.065),(.18,.034),(.187,.005)]
    for z,w in sections:
        for i in range(20):
            a=math.tau*i/20
            if sole:
                y=-.297+.014*math.cos(a)
            else:
                top=.040+.030*gaussian(z,-.025,.06)
                y=-.282+max(0,math.cos(a))*top+min(0,math.cos(a))*.013
            v.append((math.sin(a)*w,y,z))
    for j in range(len(sections)-1):
        for i in range(20):
            a=j*20+i;b=j*20+(i+1)%20;f.append((a,b,b+20,a+20))
    f.extend([tuple(range(19,-1,-1)),tuple((len(sections)-1)*20+i for i in range(20))])
    return mesh(name,v,[tuple(reversed(face)) for face in f],"sole" if sole else "shoe")
shoe_parts=[shoe_section("upper"),shoe_section("sole",True)]
for z in [.008,.027,.046]:
    shoe_parts.append(tube("lace",[(-.028,-.225,z),(.027,-.225,z+.004)],.0028,"sole",6))
shoe_parts.append(tube("toe_seam",[(-.061,-.263,.109),(-.035,-.244,.129),(0,-.240,.136),(.035,-.244,.129),(.061,-.263,.109)],.0015,"sole",6))
shoe=merge("shoe",shoe_parts)
# V2 shoe origin is the ankle; V1 retains its original asset and joint adapter.
for vertex in shoe.data.vertices:vertex.co.z+=.297

# Thin metal frames are authored to fit the adult face without hiding the eyes.
frames=[];lenses=[]
for s in (-1,1):
    pts=[]
    for i in range(33):
        a=math.tau*i/32
        pts.append((s*.089+.061*math.cos(a),.016+.046*math.sin(a),.209+.004*math.cos(a)))
    frames.append(tube("frame",pts,.0034,"metal",6))
    frames.append(tube("temple",[(s*.15,.025,.208),(s*.204,.026,.148),(s*.219,.008,.017)],.0031,"metal",8))
frames.append(tube("bridge",[(-.027,.028,.210),(0,.038,.221),(.027,.028,.210)],.003,"metal",8))
merge("glasses",frames)

phone_parts=[]
pts=[(.236*math.cos(math.pi*i/28),.235*math.sin(math.pi*i/28)+.004,-.005) for i in range(29)]
phone_parts.append(tube("headband",pts,.012,"headphones",8))
for s in (-1,1):
    phone_parts.append(ellipsoid("earcup",(s*.225,-.012,.006),(.027,.062,.045),"headphones",16,10))
    phone_parts.append(ellipsoid("earpad",(s*.207,-.012,.006),(.015,.052,.038),"shoe",12,8))
merge("headphones",phone_parts)

from character_hair import build_hair
build_hair(M)

# Independent face, grooming, eyewear and garment alternatives share the same rig.
def clone_part(source, name):
    ob=bpy.data.objects[source].copy();ob.data=ob.data.copy();ob.name=name
    bpy.context.collection.objects.link(ob)
    return ob

for shape in ("round","angular"):
    ob=clone_part("face","face_"+shape)
    for v in ob.data.vertices:
        y=v.co.z
        if shape=="round":v.co.x*=1.07-0.07*max(0,y)/.3
        else:v.co.x*=1+0.13*gaussian(y,-.18,.055)
for base in ("face","face_round","face_angular"):
    small=clone_part(base,base+"_small_nose")
    for v in small.data.vertices:
        x,y,z=v.co.x,v.co.z,-v.co.y
        if z>0:v.co.y+=.032*gaussian(x,0,.035)*gaussian(y,-.04,.06)
smile=clone_part("mouth","mouth_smile")
for v in smile.data.vertices:
    if v.co.z<-.1:v.co.z+=.012*(min(1,abs(v.co.x)/.057))**2
sneaker=clone_part("shoe","shoe_sneakers")
for v in sneaker.data.vertices:
    v.co.x*=1.08
    if v.co.z<.052:v.co.z-=.008

for style in ("square","oval"):
    ob=clone_part("glasses","glasses_"+style)
    for v in ob.data.vertices:
        if -v.co.y>.19:
            cx=.089 if v.co.x>=0 else -.089
            dx=(v.co.x-cx)/.061;dy=(v.co.z-.016)/.046
            if style=="square":
                v.co.x=cx+math.copysign(abs(dx)**.55,dx)*.061
                v.co.z=.016+math.copysign(abs(dy)**.55,dy)*.043
            else:v.co.z=.016+(v.co.z-.016)*.72
for length in ("stubble","short"):
    # A continuous conforming beard shell, not disconnected rows of cylinders.
    verts=[];faces=[];rows=18;cols=40
    for j in range(rows):
        y=-.09-j*.173/(rows-1)
        n=next((i for i in range(len(profile)-1) if profile[i+1][0]>=y),len(profile)-2)
        t=(y-profile[n][0])/(profile[n+1][0]-profile[n][0]);rx=profile[n][1]*(1-t)+profile[n+1][1]*t
        for i in range(cols):
            angle=-1.28+i*2.56/(cols-1);x=math.sin(angle)*rx
            depth=.002 if length=="stubble" else .007+.005*gaussian(y,-.22,.05)
            verts.append((x,y,face_depth(x,y)+depth))
    for j in range(rows-1):
        for i in range(cols-1):
            indices=[j*cols+i,j*cols+i+1,(j+1)*cols+i+1,(j+1)*cols+i]
            # Leave the lip/muzzle area open, with a shaped cheek line.
            center=sum(verts[k][0] for k in indices)/4;y=sum(verts[k][1] for k in indices)/4
            if y>-.19 and abs(center)<.064+(y+.19)*.18:continue
            if y>-.115 and abs(center)<.10:continue
            faces.append(tuple(indices))
    beard=mesh("beard_"+length,verts,faces,"beard_"+length)
    moustache=[]
    for sign in (-1,1):
        moustache.append(tube("moustache",[(sign*.008,-.112,.191),(sign*.029,-.116,.187),(sign*.050,-.133,.179)],
            [.003,.006 if length=="stubble" else .009,.002],"beard_"+length,8))
    merge("beard_"+length,[beard,*moustache])
    for shape in ("round","angular"):
        ob=clone_part("beard_"+length,"beard_"+length+"_"+shape)
        for v in ob.data.vertices:
            y=v.co.z
            v.co.x*=1.07-0.07*max(0,y)/.3 if shape=="round" else 1+0.13*gaussian(y,-.18,.055)
# Hood folds, pocket and drawstrings follow the torso surface.
hood=[]
hood.append(loft("hood_fold",[(.60,.13,.09,-.04),(.67,.17,.12,-.07),(.76,.15,.10,-.09),(.80,.10,.06,-.10)],"shirt",24))
for sign in (-1,1):
    hood.append(tube("drawstring",[(sign*.073,.64,.13),(sign*.067,.52,.173),(sign*.062,.39,.159)],.003,"accent",6))
hood.append(tube("kangaroo_seam",[(-.14,.18,.124),(-.09,.25,.15),(.09,.25,.15),(.14,.18,.124)],.003,"shirt_shadow",6))
merge("hoodie_details",hood)
watch=[]
watch.append(loft("watch_band",[(-.18,.044,.043,0),(-.205,.046,.045,0),(-.22,.043,.042,0)],"metal",16))
watch.append(ellipsoid("watch_face",(0,-.202,.048),(.024,.019,.006),"headphones",12,6))
merge("watch",watch)

tube("pen",[(0,-.005,0),(0,-.095,0),(0,-.105,0)],[.0035,.0035,.0005],"metal",6)

# Triangulate now so the browser doesn't need to infer polygon topology.
for ob in list(bpy.context.scene.objects):
    if ob.type != "MESH":
        continue
    bpy.context.view_layer.objects.active=ob
    mod=ob.modifiers.new("Export triangles","TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in ob.data.polygons:p.use_smooth=True
    # Local planar projections supply real UVs for cloth weave. The dominant
    # face direction keeps texel scale consistent around sleeves and trousers.
    uv = ob.data.uv_layers.new(name="Studio surface")
    for polygon in ob.data.polygons:
        axis = max(range(3), key=lambda i: abs(polygon.normal[i]))
        plane = ((1, 2), (0, 2), (0, 1))[axis]
        for loop_index in polygon.loop_indices:
            co = ob.data.vertices[ob.data.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = (co[plane[0]] * 2, co[plane[1]] * 2)

output=os.path.join(ROOT,"public","models","studio","characters.glb")
bpy.ops.export_scene.gltf(filepath=output, export_format="GLB", export_yup=True,
    export_materials="EXPORT", export_animations=False, export_cameras=False,
    export_lights=False, export_extras=False)
print("Character asset:",output)
for ob in bpy.context.scene.objects:
    if ob.type=="MESH":print(ob.name,len(ob.data.polygons),"triangles")

# Decimation is offline and keeps every named rig part/UV/material assignment.
originals={ob.name:ob.data.copy() for ob in bpy.context.scene.objects if ob.type=="MESH"}
for level,ratio in [("high",.42),("medium",.245),("low",.095)]:
    for ob in bpy.context.scene.objects:
        if ob.type!="MESH":continue
        ob.data=originals[ob.name].copy()
        bpy.context.view_layer.objects.active=ob
        # Keep enough scalp topology at Low: aggressive cap decimation can cut
        # through the independently simplified face and reveal skin triangles.
        is_low_hair=level=="low" and ob.name.startswith("hair_")
        mod=ob.modifiers.new("Offline LOD","DECIMATE");mod.ratio=.18 if is_low_hair else ratio;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        if is_low_hair:
            for vertex in ob.data.vertices:vertex.co*=1.025
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,"public","models","studio","characters-"+level+".glb"),export_format="GLB",export_yup=True,export_materials="EXPORT",export_animations=False,export_cameras=False,export_lights=False)
