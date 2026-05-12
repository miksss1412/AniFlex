package com.aniflex.app;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferHighestRefreshRate();
    }

    private void preferHighestRefreshRate() {
        Window window = getWindow();
        View decorView = window.getDecorView();

        decorView.post(() -> {
            Display display = getDisplayForRefreshRate();
            if (display == null) {
                return;
            }

            Display.Mode currentMode = display.getMode();
            float highestRefreshRate = 0f;
            int highestRefreshModeId = 0;
            for (Display.Mode mode : display.getSupportedModes()) {
                if (!hasCurrentResolution(mode, currentMode)) {
                    continue;
                }

                if (mode.getRefreshRate() > highestRefreshRate) {
                    highestRefreshRate = mode.getRefreshRate();
                    highestRefreshModeId = mode.getModeId();
                }
            }

            if (highestRefreshRate <= 0f) {
                return;
            }

            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.preferredRefreshRate = highestRefreshRate;
            attributes.preferredDisplayModeId = highestRefreshModeId;
            window.setAttributes(attributes);
        });
    }

    private boolean hasCurrentResolution(Display.Mode mode, Display.Mode currentMode) {
        return currentMode == null
                || (mode.getPhysicalWidth() == currentMode.getPhysicalWidth()
                && mode.getPhysicalHeight() == currentMode.getPhysicalHeight());
    }

    private Display getDisplayForRefreshRate() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return getDisplay();
        }

        return getWindowManager().getDefaultDisplay();
    }
}
