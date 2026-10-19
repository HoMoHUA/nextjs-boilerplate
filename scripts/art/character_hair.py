"""Sculpted, compact hairstyle meshes for the studio character.

All construction points use x/right, y/up and z/toward the face.  The final
vertices are converted to Blender's x/right, y/back, z/up frame in one place.
The six alternatives share a head-centred origin and two material slots.
"""

import math

import bpy
from mathutils import Vector


TAU = math.tau
_CAP_RADII = {
    "short": (0.222, 0.296, 0.205),
    "curly": (0.238, 0.325, 0.220),
    "fluffy": (0.231, 0.321, 0.211),
    "bun": (0.221, 0.291, 0.204),
    "bob": (0.233, 0.294, 0.211),
    "buzz": (0.213, 0.279, 0.197),
}


def _smoothstep(a, b, value):
    t = max(0.0, min(1.0, (value - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


class _HairMesh:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.material_indices = []

    def vertex(self, point):
        self.vertices.append((point[0], -point[2], point[1]))
        return len(self.vertices) - 1

    def face(self, indices, material=0):
        self.faces.append(tuple(indices))
        self.material_indices.append(material)

    def object(self, name, materials):
        mesh = bpy.data.meshes.new(name + "_mesh")
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.materials.append(materials["hair"])
        mesh.materials.append(materials["hair_highlight"])
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        for polygon, material_index in zip(mesh.polygons, self.material_indices):
            polygon.use_smooth = True
            polygon.material_index = material_index
        obj["hairstyle"] = name.removeprefix("hair_")
        return obj


def _hairline(theta, style):
    """A forehead arch, recessed temples and a lower occipital hairline."""
    front = max(0.0, math.cos(theta))
    back = max(0.0, -math.cos(theta))
    if style == "bob":
        # The opening preserves the cheeks; the remaining cap becomes a curtain.
        opening = _smoothstep(0.52, 0.95, front)
        return -0.262 + 0.414 * opening + 0.020 * back + 0.007 * math.cos(theta * 7)
    y = -0.015 + 0.150 * _smoothstep(0.10, 0.74, front) - 0.080 * back
    y += 0.006 * math.sin(5 * theta + 0.4) + 0.004 * math.cos(9 * theta)
    # Small asymmetric widow's peak, without a straight helmet rim.
    y -= 0.014 * math.exp(-((theta + 0.09) / 0.22) ** 2)
    if style == "buzz":
        y -= 0.012
    if style == "bun":
        y += 0.012 * front
    return y


def _buzz_profile(y):
    # Match the shaped skull closely so a short crop never reveals scalp islands.
    profile = [(-0.12, .201, .166, .186), (-0.08, .211, .174, .194),
               (-0.04, .215, .179, .198), (0.0, .214, .180, .200),
               (.04, .213, .177, .199), (.08, .211, .174, .196),
               (.12, .206, .172, .190), (.16, .199, .165, .181),
               (.20, .183, .153, .165), (.235, .154, .130, .140),
               (.265, .110, .093, .100), (.285, .055, .048, .051),
               (.297, .002, .002, .002)]
    for a, b in zip(profile, profile[1:]):
        if y <= b[0]:
            t = max(0.0, min(1.0, (y - a[0]) / (b[0] - a[0])))
            return tuple(a[i] + (b[i] - a[i]) * t for i in (1, 2, 3))
    return profile[-1][1:]


def _fitted_radii(style, y, theta, radial_x, radial_z):
    if y <= .293:
        width, forward, rear = _buzz_profile(y)
        clearance = 0.0 if style == "buzz" else .007
        radial_x = max(radial_x, width + clearance)
        radial_z = max(radial_z, (forward if math.cos(theta) >= 0 else rear) + clearance)
    return radial_x, radial_z


def _cap(mesh, style, sides=42, rings=11):
    rx, ry, rz = _CAP_RADII[style]
    cy = 0.018
    top = mesh.vertex((0.0, cy + ry, 0.0))
    rows = []
    for ring in range(1, rings + 1):
        u = ring / rings
        row = []
        for side in range(sides):
            theta = TAU * side / sides
            phi_max = math.acos(max(-0.995, min(0.995, (_hairline(theta, style) - cy) / ry)))
            phi = u * phi_max
            radial = math.sin(phi)
            y = cy + ry * math.cos(phi)
            if style == "bob" and phi > 1.45:
                radial = math.sin(1.45) * (1.0 - 0.035 * (phi - 1.45))
            wave = 0.0
            if style == "short":
                wave = 0.011 * math.sin(9 * theta + 2.6 * phi) * math.sin(phi)
            elif style == "curly":
                wave = (0.020 * math.sin(9 * theta + 4 * phi)
                        + 0.010 * math.sin(15 * theta - 5 * phi)) * math.sin(phi)
                y += 0.006 * math.sin(7 * theta + phi * 9) * math.sin(phi)
            elif style == "fluffy":
                wave = 0.016 * math.sin(theta * 8 - 2.2 * phi) * math.sin(phi)
                y += 0.010 * math.sin(theta * 4 + 0.4) * math.sin(phi)
            elif style == "bun":
                wave = 0.006 * math.sin(14 * theta + 3 * phi) * math.sin(phi)
            elif style == "bob":
                wave = 0.012 * math.sin(theta * 14 + 0.9 * phi) * math.sin(phi)
            elif style == "buzz":
                wave = 0.0033 * math.sin(27 * theta + phi * 23) * math.sin(phi * 19)
            radial_x, radial_z = _fitted_radii(style, y, theta,
                                              rx * radial * (1.0 + wave),
                                              rz * radial * (1.0 + wave))
            x = radial_x * math.sin(theta)
            z = radial_z * math.cos(theta)
            if style == "buzz":
                width, forward, rear = _buzz_profile(y)
                x = (width + .005) * math.sin(theta) * (1.0 + wave)
                z = ((forward if math.cos(theta) >= 0 else rear) + .005) * math.cos(theta) * (1.0 + wave)
            row.append(mesh.vertex((x, y, z)))
        rows.append(row)
    for side in range(sides):
        nxt = (side + 1) % sides
        mesh.face((top, rows[0][side], rows[0][nxt]))
    for row_index in range(len(rows) - 1):
        for side in range(sides):
            nxt = (side + 1) % sides
            mesh.face((rows[row_index][side], rows[row_index + 1][side],
                       rows[row_index + 1][nxt], rows[row_index][nxt]))
    # A narrow returned edge gives the hairline thickness without a visible rim.
    inner = []
    for index in rows[-1]:
        x, neg_z, y = mesh.vertices[index]
        inner.append(mesh.vertex((x * 0.962, y + 0.004, -neg_z * 0.962)))
    for side in range(sides):
        nxt = (side + 1) % sides
        mesh.face((rows[-1][side], inner[side], inner[nxt], rows[-1][nxt]))


def _catmull(points, steps):
    points = [Vector(point) for point in points]
    sampled = []
    for index in range(steps + 1):
        position = (len(points) - 1) * index / steps
        segment = min(len(points) - 2, int(position))
        t = position - segment
        a = points[max(0, segment - 1)]
        b = points[segment]
        c = points[segment + 1]
        d = points[min(len(points) - 1, segment + 2)]
        sampled.append(0.5 * ((2 * b) + (-a + c) * t
                              + (2 * a - 5 * b + 4 * c - d) * t * t
                              + (-a + 3 * b - 3 * c + d) * t * t * t))
    return sampled


def _lock(mesh, controls, width=0.024, depth=0.012, steps=10,
          sections=6, highlight=False, taper=0.86, closed=False,
          surface=None, lift=0.0):
    """Sweep a flattened solid lock with a soft crest and a tapered free tip."""
    points = _catmull(controls, steps)
    if surface is not None:
        rx, ry, rz = _CAP_RADII[surface]
        fitted = []
        for index, point in enumerate(points):
            q = Vector((point.x / rx, (point.y - 0.018) / ry, point.z / rz)).normalized()
            normal = Vector((q.x / rx, q.y / ry, q.z / rz)).normalized()
            theta = math.atan2(q.x, q.z)
            y = 0.018 + q.y * ry
            horizontal = math.sqrt(q.x * q.x + q.z * q.z)
            radial_x, radial_z = _fitted_radii(surface, y, theta,
                                              horizontal * rx, horizontal * rz)
            p = Vector((radial_x * math.sin(theta), y, radial_z * math.cos(theta)))
            u = index / steps
            # Bury the underside and both ends in the cap.  Only the soft upper
            # crest reads as a lock, so the result remains a continuous sculpt.
            end_blend = 1.0 - _smoothstep(0.0, 0.17, u)
            end_blend += _smoothstep(0.78, 1.0, u)
            p += normal * (lift * math.sin(math.pi * u) ** 2
                           - depth * (0.43 + 0.75 * end_blend))
            fitted.append(p)
        points = fitted
    rows = []
    for index, point in enumerate(points):
        before = points[max(0, index - 1)]
        after = points[min(len(points) - 1, index + 1)]
        tangent = (after - before).normalized()
        normal = Vector((point.x, point.y - 0.015, point.z))
        if normal.length < 0.01:
            normal = Vector((0, 1, 0))
        normal.normalize()
        across = tangent.cross(normal)
        if across.length < 0.03:
            across = tangent.cross(Vector((0, 0, 1)))
        across.normalize()
        crest = across.cross(tangent).normalized()
        if crest.dot(normal) < 0:
            crest = -crest
        u = index / steps
        if closed:
            scale = 1.0
        else:
            scale = (0.50 + 0.50 * _smoothstep(0.0, 0.18, u))
            scale *= 1.0 - taper * _smoothstep(0.62, 1.0, u)
        row = []
        for section in range(sections):
            angle = TAU * section / sections
            # The side-to-side crest is broad enough to read at avatar scale.
            p = point + across * (math.cos(angle) * width * scale)
            p += crest * (math.sin(angle) * depth * scale)
            row.append(mesh.vertex(p))
        rows.append(row)
    for row_index in range(steps):
        for section in range(sections):
            nxt = (section + 1) % sections
            accent = highlight and section == 1
            mesh.face((rows[row_index][section], rows[row_index + 1][section],
                       rows[row_index + 1][nxt], rows[row_index][nxt]), int(accent))
    mesh.face(tuple(reversed(rows[0])))
    mesh.face(rows[-1])


def _short(mesh):
    _cap(mesh, "short")
    # An offset part and overlapping diagonal locks build a swept silhouette.
    for i in range(8):
        x = -0.137 + i * 0.040
        _lock(mesh, [(x + 0.035, 0.249, -0.122),
                     (x + 0.026, 0.302 + 0.007 * math.sin(i), -0.047),
                     (x - 0.021, 0.308 - 0.010 * abs(i - 4), 0.057),
                     (x - 0.055, 0.226 - 0.008 * abs(i - 4), 0.172),
                     (x - 0.060, 0.164 + 0.005 * i, 0.184)],
              width=0.030, depth=0.009, steps=9, highlight=i in (2, 5),
              surface="short", lift=0.005)
    for sign in (-1, 1):
        _lock(mesh, [(sign * 0.165, 0.197, 0.061),
                     (sign * 0.216, 0.105, 0.058),
                     (sign * 0.204, 0.020, 0.082),
                     (sign * 0.198, -0.025, 0.072)],
              width=0.017, depth=0.007, steps=7, taper=0.94, surface="short")


def _curly(mesh):
    _cap(mesh, "curly")
    for i in range(9):
        x = -0.177 + i * 0.043
        phase = i * 1.8
        controls = []
        for j in range(7):
            t = j / 6
            crown = math.sin(t * math.pi)
            xx = x * (0.76 + 0.24 * t) + 0.022 * math.sin(phase + t * TAU * 1.3)
            yy = 0.205 + 0.129 * crown - 0.050 * t
            yy += 0.017 * math.cos(phase + t * TAU * 1.8) * crown
            zz = -0.140 + t * 0.357 + 0.012 * math.sin(phase + t * TAU * 1.5)
            controls.append((xx, yy, zz))
        _lock(mesh, controls, width=0.031, depth=0.012, steps=13,
              highlight=i in (1, 4, 7), taper=0.87, surface="curly", lift=0.009)
    for sign in (-1, 1):
        _lock(mesh, [(sign * 0.170, 0.224, 0.035),
                     (sign * 0.238, 0.170, 0.090),
                     (sign * 0.225, 0.091, 0.121),
                     (sign * 0.198, 0.075, 0.116)],
              width=0.025, depth=0.012, steps=9, surface="curly", lift=0.005)


def _fluffy(mesh):
    _cap(mesh, "fluffy")
    for i in range(8):
        x = -0.135 + 0.039 * i
        height = 0.365 - 0.009 * abs(i - 3)
        _lock(mesh, [(x + 0.055, 0.228, -0.143),
                     (x + 0.060, 0.310, -0.087),
                     (x + 0.013, height, 0.009),
                     (x - 0.058, height - 0.026, 0.119),
                     (x - 0.074, 0.231 - 0.007 * abs(i - 4), 0.202),
                     (x - 0.063, 0.173, 0.201)],
              width=0.034, depth=0.013, steps=12,
              highlight=i in (1, 4, 6), taper=0.94, surface="fluffy", lift=0.018)
    for sign in (-1, 1):
        for i in range(2):
            _lock(mesh, [(sign * 0.146, 0.264, -0.061 - i * 0.045),
                         (sign * (0.230 + i * 0.006), 0.186, -0.003 - i * 0.043),
                         (sign * 0.229, 0.080, 0.030 - i * 0.040),
                         (sign * 0.199, 0.014, 0.050 - i * 0.035)],
                  width=0.023, depth=0.009, steps=8, taper=0.95,
                  surface="fluffy", lift=0.004)


def _bun(mesh):
    _cap(mesh, "bun")
    for i in range(6):
        x = -0.143 + i * 0.055
        _lock(mesh, [(x, 0.142 + i * 0.003, 0.174),
                     (x + 0.068, 0.235, 0.104),
                     (x * 0.52 + 0.057, 0.296, -0.030),
                     (0.028, 0.286, -0.175)],
              width=0.029, depth=0.008, steps=10, highlight=i == 2,
              taper=0.50, surface="bun")
    for sign in (-1, 1):
        _lock(mesh, [(sign * .182, .039, .092),
                     (sign * .210, .133, -.013),
                     (sign * .144, .237, -.123),
                     (.021, .289, -.178)],
              width=.025, depth=.008, steps=9, surface="bun")
    # Interwoven swept loops make a gathered knot rather than a spherical bun.
    for layer in range(2):
        points = []
        for i in range(13):
            t = TAU * i / 12
            radius = 1.0 - 0.14 * layer
            x = 0.012 + 0.079 * radius * math.cos(t)
            y = 0.330 + 0.067 * radius * math.sin(t)
            z = -0.155 - 0.037 * math.sin(t * 2 + layer * 1.6) - 0.017 * layer
            points.append((x, y, z))
        _lock(mesh, points, width=0.041, depth=0.033, steps=24,
              sections=7, highlight=layer == 0, taper=0, closed=True)
    _lock(mesh, [(-0.070, 0.309, -0.126), (-0.040, 0.362, -0.107),
                 (0.012, 0.345, -0.103), (0.065, 0.325, -0.136),
                 (0.022, 0.283, -0.161)], width=0.034, depth=0.024,
          steps=12, highlight=False, taper=0.65)
    # Two fine face-framing strands stop well clear of the eyes.
    for sign in (-1, 1):
        _lock(mesh, [(sign * 0.154, 0.163, 0.137),
                     (sign * 0.187, 0.070, 0.162),
                     (sign * 0.178, -0.049, 0.172),
                     (sign * 0.200, -0.148, 0.140)],
              width=0.010, depth=0.007, steps=10, taper=0.96)


def _bob(mesh):
    _cap(mesh, "bob", sides=48, rings=14)
    for sign in (-1, 1):
        for i in range(4):
            z = 0.145 - i * 0.090
            _lock(mesh, [(sign * (0.033 + i * 0.019), 0.294 - i * 0.008, z * 0.22),
                         (sign * 0.180, 0.213, z * 0.80),
                         (sign * (0.233 + 0.003 * math.sin(i)), 0.059, z),
                         (sign * 0.230, -0.112, z * 0.96),
                         (sign * 0.205, -0.252 + 0.008 * i, z * 0.86)],
                  width=0.022, depth=0.011, steps=12,
                  highlight=i in (0, 2), taper=0.72)
        # A swept fringe follows the brow arch while keeping the central forehead.
        _lock(mesh, [(sign * 0.020, 0.303, 0.027),
                     (sign * 0.092, 0.267, 0.146),
                     (sign * 0.160, 0.169, 0.178),
                     (sign * 0.189, 0.029, 0.167),
                     (sign * 0.188, -0.122, 0.148)],
              width=0.024, depth=0.011, steps=12, highlight=False, taper=0.92)


def build_hair(materials):
    """Create and return {object_name: object} for all six named alternatives.

    ``materials`` must contain ``hair`` and ``hair_highlight`` Blender materials.
    Every style is one smooth-shaded mesh object with no transforms or modifiers.
    Visibility and any head-position translation are left to the caller.
    """
    builders = {
        "hair_short": _short,
        "hair_curly": _curly,
        "hair_fluffy": _fluffy,
        "hair_bun": _bun,
        "hair_bob": _bob,
        "hair_buzz": lambda mesh: _cap(mesh, "buzz", sides=56, rings=14),
    }
    objects = {}
    for name, builder in builders.items():
        mesh = _HairMesh()
        builder(mesh)
        objects[name] = mesh.object(name, materials)
    return objects
