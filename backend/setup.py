import setuptools

setuptools.setup(
    package_data={
        'smart_sec_cam.server': ['init_db.sql'],
    },
    include_package_data=True,
)