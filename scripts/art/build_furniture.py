"""Author the studio's reusable furniture, in meters, without external dependencies.
Run: blender --background --python scripts/art/build_furniture.py
Optional combined library: append -- --combined
Blender Z is exported as glTF Y; Blender -Y is the asset's glTF +Z front.
"""
import bpy, bmesh, math, random, json, os, sys
from mathutils import Vector
from collections import defaultdict

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../public/models/studio'))
os.makedirs(OUT, exist_ok=True)
random.seed(1729)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)


def material(name, color, roughness=.65, metallic=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=roughness
    bs.inputs['Metallic'].default_value=metallic
    return m
M={
 'sage':material('studio_fabric_sage',(.255,.315,.205),.89),
 'sage_edge':material('studio_fabric_sage_edge',(.19,.25,.155),.9),
 'ivory':material('studio_fabric_ivory',(.77,.716,.604),.92),
 'ivory_seam':material('studio_fabric_ivory_seam',(.56,.51,.41),.91),
 'oak':material('studio_oak',(.37,.20,.095),.56),
 'frame':material('studio_charcoal_frame',(.037,.044,.040),.52,.12),
 'rubber':material('studio_rubber',(.016,.021,.020),.8),
 'chrome':material('studio_chrome',(.51,.56,.54),.23,.92),
 'steel':material('studio_brushed_steel',(.45,.48,.46),.32,.82),
 'ceramic':material('studio_ceramic_ivory',(.79,.755,.669),.36),
 'soil':material('studio_soil',(.066,.041,.024),1),
 'leaf':material('studio_leaf_green',(.105,.234,.092),.57),
 'leaf_light':material('studio_leaf_light',(.19,.31,.112),.6),
 'leaf_dark':material('studio_leaf_dark',(.049,.14,.062),.56),
 'vein':material('studio_leaf_midrib',(.23,.34,.12),.58),
 'stem':material('studio_plant_stem',(.17,.25,.078),.7),
 'coffee':material('studio_coffee',(.047,.017,.006),.2),
 'crema':material('studio_coffee_crema',(.28,.13,.035),.38),
 'case':material('studio_espresso_sage',(.115,.17,.139),.4,.18),
 'gauge':material('studio_gauge_ivory',(.83,.81,.72),.45),
 'led':material('studio_amber_led',(.92,.45,.09),.3),
}
# glTF renders leaves from either side; every surface still has a coherent normal.
for k in ['leaf','leaf_light','leaf_dark']:
    M[k].use_backface_culling=False

ROOT=None

def finish(obj, mat, name=None):
    if name: obj.name=name
    obj.data.materials.append(M[mat] if isinstance(mat,str) else mat)
    obj.parent=ROOT
    if obj.type=='MESH':
        for p in obj.data.polygons: p.use_smooth=True
        if not obj.data.uv_layers:
            uv=obj.data.uv_layers.new(name='UVMap')
            for p in obj.data.polygons:
                no=p.normal; ax=max(range(3), key=lambda a:abs(no[a]))
                idx=[a for a in range(3) if a != ax]
                for li in p.loop_indices:
                    co=obj.data.vertices[obj.data.loops[li].vertex_index].co
                    uv.data[li].uv=(co[idx[0]]*2,co[idx[1]]*2)
    return obj

def mesh(name, verts, faces, mat):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob)
    return finish(ob,mat)

def box(name, loc, dims, mat, bevel=.02, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob=bpy.context.object; ob.name=name; ob.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mo=ob.modifiers.new('Soft tailored edges','BEVEL');mo.width=bevel;mo.segments=segments
        bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mo.name)
        mo=ob.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mo.name)
    return finish(ob,mat)

def cylinder(name, a, b, radius, mat, vertices=20, r2=None):
    a=Vector(a); b=Vector(b); mid=(a+b)/2;d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=radius if r2 is None else r2,depth=d.length,location=mid)
    ob=bpy.context.object;ob.name=name;ob.rotation_mode='QUATERNION';ob.rotation_quaternion=d.to_track_quat('Z','Y')
    return finish(ob,mat)

def tube(name, points, radius, mat, sides=8, closed=False):
    points=[Vector(p) for p in points]; verts=[];faces=[];previous_side=None
    for i,p in enumerate(points):
        tang=(points[(i+1)%len(points)]-points[i-1]) if closed else (points[min(i+1,len(points)-1)]-points[max(i-1,0)])
        tang.normalize()
        # Parallel transport the frame: switching reference axes on near-vertical
        # tangents otherwise twists a ceramic handle or curved petiole abruptly.
        if previous_side is None:
            reference=Vector((0,0,1)) if abs(tang.z)<.96 else Vector((0,1,0))
            side=tang.cross(reference).normalized()
        else:
            side=previous_side-tang*previous_side.dot(tang)
            if side.length<1e-7:side=tang.cross(Vector((0,1,0)))
            side.normalize()
        previous_side=side.copy();up=side.cross(tang).normalized()
        for j in range(sides):
            ang=j*math.tau/sides;verts.append(p+radius*(math.cos(ang)*side+math.sin(ang)*up))
    for i in range(len(points) if closed else len(points)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%len(points))*sides+(j+1)%sides,((i+1)%len(points))*sides+j))
    if not closed:
        faces.append(tuple(range(sides-1,-1,-1)));faces.append(tuple((len(points)-1)*sides+j for j in range(sides)))
    return mesh(name,verts,faces,mat)

def torus(name, center, major, minor, mat, rotation=(0,0,0), major_segments=32, minor_segments=8):
    bpy.ops.mesh.primitive_torus_add(major_segments=major_segments,minor_segments=minor_segments,location=center,major_radius=major,minor_radius=minor,rotation=rotation)
    return finish(bpy.context.object,mat,name)

def lathe(name, profile, mat, n=48):
    vs=[];fs=[]
    for radius,height in profile:
        for j in range(n):
            a=j*math.tau/n;vs.append((radius*math.cos(a),radius*math.sin(a),height))
    for i in range(len(profile)-1):
        for j in range(n):fs.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    return mesh(name,vs,fs,mat)

def catmull(controls, steps=4, closed=True):
    pts=[Vector(p) for p in controls];res=[]
    for i in range(len(pts) if closed else len(pts)-1):
        p0=pts[(i-1)%len(pts)] if closed or i>0 else pts[0]
        p1=pts[i];p2=pts[(i+1)%len(pts)]
        p3=pts[(i+2)%len(pts)] if closed or i+2<len(pts) else pts[-1]
        for j in range(steps):
            t=j/steps
            res.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
    if not closed:res.append(pts[-1])
    return res

def padded_outline(name, outline, depth, mapper, mat, rings=12):
    # A smooth, closed, inflated panel with a real silhouette and planar fabric UVs.
    vs=[];fs=[];n=len(outline)
    for row in range(rings+1):
        a=.008+(math.pi-.016)*row/rings;s=math.sin(a)**.23;d=-math.cos(a)*depth
        for p in outline:vs.append(mapper(p[0]*s,p[1]*s,d))
    for i in range(rings):
        for j in range(n):fs.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    fs.append(tuple(range(n-1,-1,-1)));fs.append(tuple(rings*n+j for j in range(n)))
    ob=mesh(name,vs,fs,mat)
    # Explicit continuous UVs on both faces, with meter-scaled weave.
    uv=ob.data.uv_layers.active
    for poly in ob.data.polygons:
        for li in poly.loop_indices:
            v=ob.data.vertices[ob.data.loops[li].vertex_index].co
            uv.data[li].uv=(v.x*2,(v.z if 'back' in name else v.y)*2)
    return ob

def rounded_outline(w,h,r,steps=6):
    res=[]
    for cx,cy,a in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for j in range(steps+1):
            theta=math.radians(a+j*90/steps)
            res.append((cx+r*math.cos(theta),cy+r*math.sin(theta)))
    return res

def root(name):
    global ROOT
    ROOT=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(ROOT)
    ROOT['units']='meters';ROOT['front']='+Z in glTF';ROOT['up']='+Y in glTF'
    return ROOT


def office_chair(name='office_chair',height=1.18):
    r=root(name)
    # Seat: broad front roll, plump surface, dark moulded underpan.
    padded_outline('sculpted_seat_cushion',rounded_outline(.53,.475,.088),.043,lambda x,y,d:(x,y-.016,.412-d),'sage')
    seat_seam=[(x,y-.016,.412) for x,y in rounded_outline(.53,.475,.088,8)]
    tube('tailored_seat_perimeter_piping',seat_seam,.0028,'sage_edge',6,True)
    box('moulded_seat_underpan',(0,.0,.363),(.475,.407,.058),'frame',.034,4)
    # The shell wraps forward around shoulders and projects into the lumbar area.
    bh=height-.49; cz=.49+bh/2
    controls=[(-.145,-bh/2),(-.215,-bh/2+.045),(-.226,-bh*.25),(-.241,bh*.12),(-.257,bh*.35),(-.23,bh/2-.015),(-.13,bh/2),(.13,bh/2),(.23,bh/2-.015),(.257,bh*.35),(.241,bh*.12),(.226,-bh*.25),(.215,-bh/2+.045),(.145,-bh/2)]
    outline=catmull(controls,4)
    def shape(x,z,d,back=False):
        frac=(z+bh/2)/bh
        lumbar=.032*math.exp(-((frac-.27)/.2)**2)
        center=.189+.105*frac-.065*(x/.26)**2-lumbar
        return (x,center+d+( .033 if back else 0),cz+z)
    padded_outline('upholstered_back_shell',[(p.x*.99,p.y*.995) for p in outline],.056,lambda x,z,d:shape(x,z,d,True),'sage_edge',10)
    padded_outline('ergonomic_back_cushion',outline,.054,shape,'sage',12)
    # Perimeter piping is inset on the visible front of the cushion.
    tube('back_perimeter_tailored_piping',[shape(p.x*.987,p.y*.99,-.017) for p in outline],.0029,'sage_edge',6,True)
    # Soft lumbar seam, gently follows the curved back face.
    seam=[]
    for i in range(17):
        x=-.203+i*.406/16;zz=-bh*.23
        seam.append(shape(x,zz,-.054))
    tube('lumbar_upholstery_seam',seam,.0013,'sage_edge',5)
    # Rear structural support arches smoothly into the upholstered shell.
    tube('back_support_spine',catmull([(0,.09,.355),(0,.225,.40),(0,.27,.55),(0,.28,.76)],6,False),.023,'frame',10)
    for side in [-1,1]:
        # Arms flare slightly away from the seat and have shaped padded top rests.
        tube('armrest_upright',catmull([(side*.19,.08,.36),(side*.275,.06,.415),(side*.294,.016,.55),(side*.294,-.005,.605)],5,False),.019,'frame',8)
        ob=box('soft_armrest_pad',(side*.291,-.039,.629),(.069,.271,.035),'frame',.016,4)
        ob.rotation_euler[0]=math.radians(2)
    # Gas lift, tilt mechanism, adjustment paddle and five realistic paired wheels.
    cylinder('chrome_gas_lift',(0,0,.177),(0,0,.347),.026,'chrome',24)
    cylinder('piston_sleeve',(0,0,.113),(0,0,.244),.038,'frame',24)
    box('seat_tilt_housing',(0,.006,.319),(.175,.175,.068),'frame',.025,3)
    cylinder('tension_knob',(.105,.01,.316),(.16,.01,.316),.033,'frame',20)
    tube('height_adjustment_lever',[(.06,-.05,.338),(.135,-.09,.33),(.212,-.11,.338)],.006,'steel',8)
    box('height_lever_grip',(.211,-.11,.338),(.049,.038,.014),'frame',.006,3)
    cylinder('five_spoke_hub',(0,0,.108),(0,0,.163),.055,'frame',24)
    for j in range(5):
        a=math.tau*j/5+math.pi/10;dx=math.cos(a);dy=math.sin(a)
        tube('five_spoke_base',[(dx*.028,dy*.028,.142),(dx*.15,dy*.15,.112),(dx*.278,dy*.278,.082)],.020,'frame',8)
        cx=dx*.283;cy=dy*.283
        cylinder('caster_swivel_pin',(cx,cy,.063),(cx,cy,.094),.012,'steel',12)
        # Horizontal caster axle is tangent to the five-spoke radius.
        tangent=Vector((-dy,dx,0));center=Vector((cx,cy,.035))
        for side in [-1,1]:
            wheel=center+tangent*(side*.022)
            cylinder('double_caster_rubber',wheel-tangent*.012,wheel+tangent*.012,.035,'rubber',20)
            cylinder('caster_hub',wheel-tangent*.0125,wheel+tangent*.0125,.018,'frame',16)
    return r


def lounge_chair():
    r=root('lounge_chair')
    # Barrel upholstery follows a continuous horseshoe, open at the front.
    vs=[];fs=[]; n=48;levels=16
    for i in range(n+1):
        t=math.radians(-38+256*i/n)
        # horseshoe back: its center sits behind the seat, at Blender +Y.
        x=.525*math.cos(t);y=.04+.45*math.sin(t)
        # Rotate the opening to front (-Y), with forward arms flaring outward.
        # theta range -38..218 goes via rear +Y, leaving the front opening.
        shoulder=math.sin(math.pi*i/n)**.45
        top=.78+.52*shoulder
        bottom=.34
        for j in range(levels+1):
            q=j/levels
            # thickness is a rounded elliptical cross section, including rolled top edge.
            ang=math.tau*q
            radial=.075*math.sin(ang)
            zz=bottom+(top-bottom)*(.5-.5*math.cos(ang))
            xx=(.525+radial)*math.cos(t); yy=.04+(.45+radial)*math.sin(t)
            vs.append((xx,yy,zz))
    for i in range(n):
        for j in range(levels):fs.append((i*(levels+1)+j,(i+1)*(levels+1)+j,(i+1)*(levels+1)+j+1,i*(levels+1)+j+1))
    # each end is closed, a smooth pill-shaped arm terminal.
    fs.append(tuple(range(levels,-1,-1)));fs.append(tuple(n*(levels+1)+j for j in range(levels+1)))
    mesh('continuous_barrel_upholstered_back',vs,fs,'ivory')
    # Separately upholstered seat with plump top and a restrained welt seam.
    padded_outline('individual_lounge_seat_cushion',rounded_outline(.89,.94,.19,8),.078,lambda x,y,d:(x,y-.025,.472-d),'ivory',12)
    tube('lounge_seat_cushion_piping',[(x,y-.025,.474) for x,y in rounded_outline(.89,.94,.19,8)],.003,'ivory_seam',6,True)
    # Tailored line follows the rolled edge along the inner back.
    edge=[]
    for i in range(n+1):
        t=math.radians(-38+256*i/n);shoulder=math.sin(math.pi*i/n)**.45
        edge.append((.51*math.cos(t),.04+.435*math.sin(t),.78+.52*shoulder-.014))
    tube('barrel_back_piped_seam',edge,.003,'ivory_seam',6)
    # Compact timber legs have a tapered, slightly splayed profile.
    for x in [-.365,.365]:
        for y in [-.282,.29]:
            cylinder('splayed_tapered_oak_leg',(x*1.13,y*1.15,.035),(x,y,.385),.022,'oak',12,.035)
            cylinder('felt_leg_pad',(x*1.13,y*1.15,0),(x*1.13,y*1.15,.036),.023,'frame',12)
    return r


def plant():
    r=root('plant')
    lathe('hollow_ceramic_planter',[(0,0),(.255,0),(.27,.018),(.277,.06),(.337,.575),(.34,.613),(.335,.635),(.321,.64),(.309,.631),(.307,.603),(.253,.07),(0,.07)],'ceramic',40)
    cylinder('visible_potting_soil',(0,0,.584),(0,0,.596),.307,'soil',40)
    # Discreet natural soil fragments, all part of the single soil draw call.
    for i in range(6):
        ang=random.random()*math.tau;rr=random.random()**.5*.28
        box('bark_fragment',(rr*math.cos(ang),rr*math.sin(ang),.598),(random.uniform(.012,.03),.012,.007),'soil',.003,1).rotation_euler[2]=ang
    for i in range(18):
        a=i*2.39996323+random.uniform(-.16,.16)
        # A tall clustered variety with broad, slightly folded leaves.
        if i<5: stem_h=1.11+random.uniform(0,.12); leaf_len=.56+random.uniform(-.03,.045); tip_h=1.72+random.uniform(-.05,.08); reach=.22+random.random()*.11
        elif i<12: stem_h=.98+random.uniform(0,.14);leaf_len=.48+random.uniform(-.04,.06);tip_h=1.40+random.uniform(-.06,.11);reach=.49+random.random()*.13
        else: stem_h=.83+random.uniform(0,.12);leaf_len=.41+random.uniform(-.05,.03);tip_h=1.06+random.uniform(-.09,.12);reach=.53+random.random()*.12
        radial=Vector((math.cos(a),math.sin(a),0)); side=Vector((-math.sin(a),math.cos(a),0))
        base=radial*random.uniform(.02,.065)+Vector((0,0,.59))
        leafbase=radial*(reach*.34)+Vector((0,0,stem_h))
        tube('curved_leaf_petiole',catmull([base,radial*.10+Vector((0,0,.8)),leafbase],3,False),.006 if i<12 else .005,'stem',6)
        tip=radial*reach+side*random.uniform(-.045,.045)+Vector((0,0,tip_h))
        # Lanceolate surface is swept along an arched, irregular center line.
        width=(.105 if i<5 else .135 if i<12 else .12)*random.uniform(.86,1.16)
        centers=[];vs=[];fs=[]; rows=12;cols=6
        for j in range(rows+1):
            t=j/rows
            center=leafbase.lerp(tip,t)+Vector((0,0,math.sin(math.pi*t)*(.10 if i<12 else .13)))
            center+=side*(math.sin(math.pi*t)*.035*math.sin(i+1))
            centers.append(center)
            w=width*(math.sin(math.pi*t)**.75)*(.85+.15*t)
            for k in range(cols+1):
                s=-1+2*k/cols
                ridge=.014*(1-abs(s))-.02*(abs(s)**1.3)
                ripple=.004*math.sin(13*t+i)*s*s
                v=center+side*(s*w)+Vector((0,0,(ridge+ripple)*math.sin(math.pi*t)))
                vs.append(v)
        for j in range(rows):
            for k in range(cols):
                a0=j*(cols+1)+k;fs.append((a0,a0+1,a0+cols+2,a0+cols+1))
        mesh('swept_broad_tapered_leaf',vs,fs,['leaf','leaf_light','leaf_dark'][i%3])
        tube('raised_leaf_midrib',[c+Vector((0,0,.006*math.sin(math.pi*j/rows))) for j,c in enumerate(centers) if j%2==0],.0017,'vein',4)
    return r


def mug():
    r=root('mug')
    lathe('hollow_stoneware_mug',[(0,0),(.067,0),(.077,.007),(.080,.018),(.088,.15),(.09,.173),(.089,.178),(.085,.18),(.081,.178),(.080,.171),(.073,.025),(.069,.019),(0,.019)],'ceramic',48)
    tube('rounded_ceramic_handle',catmull([(.081,0,.145),(.123,0,.156),(.151,0,.133),(.155,0,.092),(.136,0,.052),(.084,0,.044)],7,False),.012,'ceramic',10)
    cylinder('coffee_inside_mug',(0,0,.149),(0,0,.152),.078,'coffee',48)
    torus('coffee_meniscus',(0,0,.152),.0768,.0012,'crema',major_segments=48,minor_segments=5)
    return r


def espresso():
    r=root('espresso')
    box('rounded_sage_machine_case',(0,.058,.218),(.50,.365,.402),'case',.027,5)
    box('stainless_front_fascia',(0,-.132,.258),(.446,.022,.297),'steel',.015,4)
    box('black_recess_behind_grouphead',(0,-.149,.164),(.273,.012,.18),'frame',.012,3)
    box('machine_base',(0,-.018,.025),(.50,.55,.05),'case',.015,3)
    box('chrome_drip_tray',(0,-.208,.061),(.441,.175,.026),'steel',.009,3)
    # Parallel tray slats make the grate identifiable even from an isometric camera.
    for j in range(11):
        box('drip_tray_grate_slot',(-.19+j*.038,-.209,.075),(.010,.137,.003),'frame',.003,2)
    cylinder('polished_group_head',(0,-.18,.225),(0,-.18,.284),.066,'chrome',28)
    cylinder('portafilter_basket',(0,-.18,.207),(0,-.18,.232),.052,'steel',24)
    tube('portafilter_chrome_neck',[(.035,-.19,.215),(.075,-.222,.214),(.104,-.245,.212)],.011,'chrome',10)
    tube('black_portafilter_handle',[(.092,-.237,.212),(.139,-.271,.207),(.183,-.292,.204)],.018,'frame',12)
    # Double coffee spout beneath the filter.
    for x in [-.021,.021]:tube('coffee_spout',[(x,-.181,.209),(x,-.181,.190),(x,-.195,.182)],.007,'chrome',8)
    # A small circular pressure gauge and its actual needle and dial tick marks.
    center=Vector((-.137,-.154,.326))
    cylinder('pressure_gauge_bezel',center+Vector((0,.004,0)),center+Vector((0,-.009,0)),.041,'chrome',32)
    cylinder('ivory_pressure_gauge_face',center+Vector((0,-.01,0)),center+Vector((0,-.012,0)),.035,'gauge',32)
    for j in range(9):
        a=math.radians(-130+j*32.5)
        p=center+Vector((math.sin(a)*.028,-.013,math.cos(a)*.028))
        q=center+Vector((math.sin(a)*.032,-.013,math.cos(a)*.032))
        tube('pressure_dial_mark',[p,q],.001,'frame',4)
    tube('pressure_gauge_needle',[center+Vector((.006,-.015,-.008)),center+Vector((-.016,-.015,.021))],.0015,'frame',5)
    cylinder('espresso_control_dial',(.142,-.151,.324),(.142,-.182,.324),.034,'frame',24)
    cylinder('dial_chrome_cap',(.142,-.183,.324),(.142,-.186,.324),.026,'chrome',24)
    box('dial_indicator',(.142,-.189,.344),(.003,.003,.009),'frame',.001,1)
    cylinder('brew_button',(.047,-.151,.328),(.047,-.163,.328),.013,'chrome',20)
    cylinder('warm_amber_power_light',(.047,-.164,.328),(.047,-.166,.328),.005,'led',12)
    # Steam wand: polished bent tube, rubber touch point, perforated tip.
    tube('bent_stainless_steam_wand',catmull([(.188,-.156,.253),(.212,-.18,.235),(.211,-.211,.135),(.178,-.252,.111)],6,False),.006,'chrome',8)
    cylinder('steam_wand_grip',(.211,-.202,.184),(.211,-.208,.158),.010,'frame',14)
    cylinder('steam_wand_nozzle',(.178,-.252,.108),(.174,-.256,.095),.009,'chrome',12)
    # Removable water tank behind, warm tray inset and rail at the top.
    box('top_cup_warming_plate',(0,.059,.418),(.404,.272,.005),'steel',.008,3)
    for x in [-.196,.196]:tube('warming_tray_guardrail',[(x,-.05,.416),(x,.17,.416)],.004,'chrome',8)
    for x in [-.194,.194]:
        for y in [-.20,.18]:cylinder('machine_rubber_foot',(x,y,0),(x,y,.018),.020,'rubber',12)
    return r

assets=[office_chair(),office_chair('executive_chair',1.34),lounge_chair(),plant(),mug(),espresso()]
# Apply the custom mesh normals consistently and merge static parts by material.
# glTF uses one primitive per material: this gives each asset only 4--9 draw calls.
report={}
for asset in assets:
    groups=defaultdict(list)
    for ob in list(asset.children):
        if ob.type=='MESH':groups[ob.data.materials[0].name].append(ob)
    for mat,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects:ob.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        joined=bpy.context.object;joined.name=asset.name+'__'+mat
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        # Weld the analytically collapsed leaf tips / lathe poles and remove zero-area
        # bevel slivers, retaining UV layers and all visible silhouette details.
        bm=bmesh.new();bm.from_mesh(joined.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
        bmesh.ops.dissolve_degenerate(bm,dist=1e-8,edges=list(bm.edges))
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(joined.data);bm.free();joined.data.update()
        # Recalculate mesh normals before export. UVs survive the join.
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    verts=[ob.matrix_world@v.co for ob in asset.children if ob.type=='MESH' for v in ob.data.vertices]
    triangles=sum(sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in asset.children if ob.type=='MESH')
    lo=[min(v[i] for v in verts) for i in range(3)];hi=[max(v[i] for v in verts) for i in range(3)]
    report[asset.name]={'triangles':triangles,'mesh_primitives':len(asset.children),'blender_bounds':[lo,hi],'gltf_dimensions':[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]],'materials':[ob.data.materials[0].name for ob in asset.children]}

filenames={'office_chair':'furniture-chair.glb','executive_chair':'furniture-executive-chair.glb','lounge_chair':'furniture-lounge.glb','plant':'furniture-plant.glb','mug':'furniture-mug.glb','espresso':'furniture-espresso.glb'}
for asset in assets:
    bpy.ops.object.select_all(action='DESELECT');asset.select_set(True)
    for ob in asset.children:ob.select_set(True)
    fn=os.path.join(OUT,filenames[asset.name])
    bpy.ops.export_scene.gltf(filepath=fn,export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
    report[asset.name]['bytes']=os.path.getsize(fn)

if '--combined' in sys.argv:
    bpy.ops.object.select_all(action='DESELECT')
    for asset in assets:
        asset.select_set(True)
        for ob in asset.children:ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'furniture.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
print('FURNITURE_REPORT '+json.dumps(report,indent=2))
with open('/tmp/studio-furniture-report.json','w') as f:json.dump(report,f,indent=2)

# Consistent, softly lit isolated previews. Export occurs before the display layout.
if os.environ.get('FURNITURE_PREVIEW','1') != '0':
    for asset in assets:
        asset.hide_render=True
    bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=32
    bpy.context.scene.cycles.use_denoising=False
    bpy.context.scene.render.resolution_x=700;bpy.context.scene.render.resolution_y=700;bpy.context.scene.render.resolution_percentage=100
    bpy.context.scene.world.color=(.28,.28,.28)
    bpy.context.scene.view_settings.view_transform='AgX'
    # Matte warm floor plus large studio lights.
    ROOT=None
    floor=box('preview_floor',(0,0,-.055),(200,200,.1),material('preview_floor',(.67,.64,.58),.85),.0)
    for loc,power,size in [((3,-4,6),520,4),((-3,-1,4),300,3),((1,4,5),450,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size
        light.rotation_euler=(Vector((0,0,.6))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;bpy.context.scene.camera=cam;cam.data.type='ORTHO'
    for asset in assets:
        target_names=os.environ.get('FURNITURE_PREVIEW_TARGET','').split(',')
        if target_names != [''] and asset.name not in target_names:continue
        for a in assets:
            for ob in a.children:ob.hide_render=(a!=asset)
        asset.hide_render=False
        dims=report[asset.name]['gltf_dimensions'];h=dims[1]
        target=Vector((0,0,h*.48));cam.location=target+Vector((2.8,-4,2.2))*max(h,.25)
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=max(dims)*1.55
        bpy.context.scene.render.filepath='/tmp/studio-'+asset.name+'.png';bpy.ops.render.render(write_still=True)
