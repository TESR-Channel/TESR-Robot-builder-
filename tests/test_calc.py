import math

from tesr_robot_builder.calc import geometry as g


def test_footprint_is_centred_rectangle_with_margin():
    fp = g.footprint_polygon(1.0, 0.7, 0.05)
    assert fp == [[0.55, 0.4], [-0.55, 0.4], [-0.55, -0.4], [0.55, -0.4]]


def test_inflation_exceeds_circumscribed_radius():
    assert g.inflation_radius(1.0, 0.7, 0.05) > g.circumscribed_radius(1.0, 0.7, 0.05)
    assert math.isclose(g.circumscribed_radius(1.0, 0.7), math.hypot(0.5, 0.35), abs_tol=1e-4)


def test_local_costmap_is_clamped_and_rounded():
    assert g.local_costmap_size(0.3, 0.5, 0.26) == 3.0  # small slow robot → minimum
    assert g.local_costmap_size(2.0, 0.5, 1.0) == 6.0  # fast robot → maximum
    assert g.local_costmap_size(1.0, 0.5, 1.0) == 4.0  # 2*(1.0 + 1.0) = 4.0


def test_obstacle_and_raytrace_ranges():
    obst = g.obstacle_range(12.0, 4.0)
    assert obst == 2.0
    assert g.raytrace_range(obst) == 2.5
    assert g.obstacle_range(1.5, 6.0) == 1.35


def test_wheel_poses():
    diff = g.wheel_poses("differential", 0.6, None)
    assert [w.name for w in diff] == ["left_wheel", "right_wheel"]
    assert diff[0].y == 0.3 and diff[1].y == -0.3
    mec = g.wheel_poses("mecanum", 0.44, 0.40)
    assert len(mec) == 4 and mec[0].x == 0.2 and mec[3].y == -0.22


def test_inertia_floor_and_symmetry():
    i = g.box_inertia(0.01, 0.03, 0.03, 0.01).as_dict()
    assert min(i.values()) >= 1e-6
    c = g.cylinder_inertia(1.0, 0.08, 0.05)
    assert c.ixx == c.iyy and c.izz == 1.0 * 0.08 ** 2 / 2
