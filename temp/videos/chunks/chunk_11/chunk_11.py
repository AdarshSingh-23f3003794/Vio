from manim import *

class VideoScene(Scene):
    def construct(self):
        # Simple text animation for 5 seconds
        title = Text("What is Machine Learning?", font_size=40, color=BLUE)
        content = Text("Imagine you're trying to teach a child to recognize different animals. You show them pictures of cat...", font_size=24, color=WHITE)
        content.scale_to_fit_width(11)
        
        # Animate title
        self.play(Write(title), run_time=1.5)
        self.wait(0.5)
        
        # Animate content
        self.play(Transform(title, content), run_time=1)
        self.wait(2)
        
        # Final fade out
        self.play(FadeOut(title), run_time=0.5)