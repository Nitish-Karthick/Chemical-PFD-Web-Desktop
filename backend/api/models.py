from django.db import models

class Project(models.Model):
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=2000, default=None, null=True, blank=True)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField( auto_now=True)

    def __str__(self):
        return self.name

class Component(models.Model):
    s_no = models.CharField(max_length=10, unique=True)
    parent = models.CharField(max_length=100)  # Category name
    name = models.CharField(max_length=100)
    legend = models.CharField(max_length=100, blank=True)
    suffix = models.CharField(max_length=10, blank=True)
    object = models.CharField(max_length=100)
    svg = models.FileField(upload_to='components/', null=True, blank=True)
    png = models.ImageField(upload_to='components/', null=True, blank=True)
    grips = models.JSONField(default=list)
    created_by = models.ForeignKey('auth.User', on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return self.name

class CanvasState(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    component = models.ForeignKey(Component, on_delete=models.CASCADE)
    label = models.CharField(max_length=100)
    x = models.FloatField()
    y = models.FloatField()
    width = models.FloatField()
    height = models.FloatField()
    rotation = models.FloatField(default=0)
    scaleX = models.FloatField(default=1)
    scaleY = models.FloatField(default=1)
    sequence = models.IntegerField()

class Connection(models.Model):
    sourceItemId = models.ForeignKey(CanvasState, on_delete=models.CASCADE, related_name="sources")
    sourceGripIndex = models.IntegerField()
    targetItemId = models.ForeignKey(CanvasState, on_delete=models.CASCADE, related_name="targets")
    targetGripIndex = models.IntegerField()
    waypoints = models.JSONField()