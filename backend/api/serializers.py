from rest_framework import serializers
from .models import Component, Project, CanvasState, Connection
import json

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = (
            "id",
            "user",
            "created_at",
            "updated_at",
        )

    def create(self, validated_data):
        request = self.context["request"]
        return Project.objects.create(
            user=request.user,
            **validated_data
        )

class ComponentSerializer(serializers.ModelSerializer):
    svg_url = serializers.SerializerMethodField()
    png_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Component
        fields = '__all__'
    
    def to_internal_value(self, data):
        # Convert QueryDict to standard dict to handle JSON parsing correctly
        if hasattr(data, 'dict'):
            data = data.dict()
        elif hasattr(data, 'copy'):
            data = data.copy()

        grips = data.get("grips")

        if isinstance(grips, str):
            try:
                data["grips"] = json.loads(grips)
            except json.JSONDecodeError:
                raise serializers.ValidationError({
                    "grips": "Invalid JSON format"
                })

        return super().to_internal_value(data)
    
    def get_svg_url(self, obj):
        request = self.context.get('request')
        if obj.svg and hasattr(obj.svg, 'url'):
            if request:
                return request.build_absolute_uri(obj.svg.url)
            return obj.svg.url
        return None
    
    def get_png_url(self, obj):
        request = self.context.get('request')
        if obj.png and hasattr(obj.png, 'url'):
            if request:
                return request.build_absolute_uri(obj.png.url)
            return obj.png.url
        return None
class CanvasStateSerializer(serializers.ModelSerializer):
    # Component fields (flattened)
    component_id = serializers.IntegerField(source="component.id", read_only=True)
    s_no = serializers.CharField(source="component.s_no", read_only=True)
    parent = serializers.CharField(source="component.parent", read_only=True)
    name = serializers.CharField(source="component.name", read_only=True)
    svg = serializers.ImageField(source="component.svg", read_only=True)
    png = serializers.ImageField(source="component.png", read_only=True)
    object = serializers.CharField(source="component.object", read_only=True)
    legend = serializers.CharField(source="component.legend", read_only=True)
    suffix = serializers.CharField(source="component.suffix", read_only=True)
    grips = serializers.JSONField(source="component.grips", read_only=True)

    class Meta:
        model = CanvasState
        fields = [
            "id",
            "project",
            "component_id",
            "label",

            # canvas transform
            "x",
            "y",
            "width",
            "height",
            "rotation",
            "scaleX",
            "scaleY",
            "sequence",

            # component info
            "s_no",
            "parent",
            "name",
            "svg",
            "png",
            "object",
            "legend",
            "suffix",
            "grips",
        ]

        def to_internal_value(self, data):
            grips = data.get("grips")

            if isinstance(grips, str):
                try:
                    data["grips"] = json.loads(grips)
                except json.JSONDecodeError:
                    raise serializers.ValidationError({
                        "grips": "Invalid JSON format"
                    })

            return super().to_internal_value(data)

class ConnectionSerializer(serializers.ModelSerializer):
    sourceItemId = serializers.PrimaryKeyRelatedField(
        queryset=CanvasState.objects.all()
    )
    targetItemId = serializers.PrimaryKeyRelatedField(
        queryset=CanvasState.objects.all()
    )

    class Meta:
        model = Connection
        fields = [
            "id",
            "sourceItemId",
            "sourceGripIndex",
            "targetItemId",
            "targetGripIndex",
            "waypoints",
        ]

