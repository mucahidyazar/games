// Native helpers for Trap The Orb on iOS: haptic feedback, the share sheet and the screen scale.
#import <UIKit/UIKit.h>

extern UIViewController* UnityGetGLViewController(void);

extern "C" {

/// 0: a broken wall, 1: a cleared level, 2: game over.
void TTO_Haptic(int kind)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        if (kind == 0) {
            UIImpactFeedbackGenerator* impact = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
            [impact prepare];
            [impact impactOccurred];
            return;
        }
        UINotificationFeedbackGenerator* notification = [[UINotificationFeedbackGenerator alloc] init];
        [notification prepare];
        [notification notificationOccurred:kind == 1 ? UINotificationFeedbackTypeSuccess : UINotificationFeedbackTypeError];
    });
}

void TTO_Share(const char* text)
{
    if (text == NULL) return;
    NSString* message = [NSString stringWithUTF8String:text];
    dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController* root = UnityGetGLViewController();
        if (root == nil) return;
        UIActivityViewController* sheet = [[UIActivityViewController alloc] initWithActivityItems:@[message] applicationActivities:nil];
        // iPads present the sheet as a popover, which needs an anchor.
        sheet.popoverPresentationController.sourceView = root.view;
        sheet.popoverPresentationController.sourceRect = CGRectMake(CGRectGetMidX(root.view.bounds), CGRectGetMidY(root.view.bounds), 1, 1);
        sheet.popoverPresentationController.permittedArrowDirections = 0;
        [root presentViewController:sheet animated:YES completion:nil];
    });
}

/// Device pixels per point, like the browser's devicePixelRatio.
float TTO_ScreenScale(void)
{
    return (float)[UIScreen mainScreen].nativeScale;
}

}
