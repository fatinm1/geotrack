"""Initial schema - traffic_cameras, camera_detections, aircraft_latest

Revision ID: 001_initial
Revises:
Create Date: 2025-02-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "traffic_cameras",
        sa.Column("camera_id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("geom", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("stream_url", sa.Text(), nullable=False),
        sa.Column("snapshot_url", sa.Text(), nullable=True),
        sa.Column("region", sa.String(128), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "camera_detections",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("camera_id", sa.String(64), sa.ForeignKey("traffic_cameras.camera_id", ondelete="CASCADE"), nullable=False),
        sa.Column("ts", sa.DateTime(), nullable=False),
        sa.Column("vehicle_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("congestion_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("meta", sa.dialects.postgresql.JSONB(), nullable=True),
    )

    op.create_table(
        "aircraft_latest",
        sa.Column("icao24", sa.String(6), primary_key=True),
        sa.Column("callsign", sa.String(16), nullable=True),
        sa.Column("geom", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("altitude", sa.Float(), nullable=True),
        sa.Column("velocity", sa.Float(), nullable=True),
        sa.Column("heading", sa.Float(), nullable=True),
        sa.Column("ts", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("aircraft_latest")
    op.drop_table("camera_detections")
    op.drop_table("traffic_cameras")
