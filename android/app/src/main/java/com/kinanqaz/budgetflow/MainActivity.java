package com.kinanqaz.budgetflow;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Insets;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public final class MainActivity extends Activity {
    static final String PREFS_NAME = "budgetflow_settings";
    static final String PREF_SERVER_URL = "server_url";

    private static final int BACKGROUND = Color.rgb(15, 18, 32);
    private static final int ACCENT = Color.rgb(59, 130, 246);
    private EditText serverAddress;
    private TextView errorMessage;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String savedServer = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getString(PREF_SERVER_URL, "");
        if (savedServer != null && !savedServer.trim().isEmpty()) {
            launchWebActivity(savedServer);
            return;
        }

        configureSystemBars();
        setContentView(createContent());
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(BACKGROUND);
        window.setNavigationBarColor(BACKGROUND);
        window.getDecorView().setSystemUiVisibility(0);
    }

    private ScrollView createContent() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BACKGROUND);
        scroll.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 35) {
                Insets barsAndCutout = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(
                        barsAndCutout.left,
                        barsAndCutout.top,
                        barsAndCutout.right,
                        Math.max(barsAndCutout.bottom, ime.bottom));
                return WindowInsets.CONSUMED;
            }
            return insets;
        });

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER_VERTICAL);
        page.setPadding(dp(28), dp(24), dp(28), dp(24));
        page.setBackgroundColor(BACKGROUND);

        TextView title = text("BudgetFlow", 28, Color.WHITE, true);
        page.addView(title, matchWrap());

        TextView fieldLabel = text("Server address", 14, Color.WHITE, true);
        LinearLayout.LayoutParams labelParams = matchWrap();
        labelParams.topMargin = dp(28);
        page.addView(fieldLabel, labelParams);

        serverAddress = new EditText(this);
        serverAddress.setSingleLine(true);
        serverAddress.setTextSize(16);
        serverAddress.setTextColor(Color.WHITE);
        serverAddress.setHintTextColor(Color.rgb(132, 141, 164));
        serverAddress.setHint("https://budget.example.com");
        serverAddress.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        serverAddress.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_GO);
        serverAddress.setPadding(dp(16), dp(14), dp(16), dp(14));
        serverAddress.setBackground(roundRect(Color.rgb(31, 36, 54), dp(12)));
        SharedPreferences preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        serverAddress.setText(preferences.getString(PREF_SERVER_URL, ""));
        LinearLayout.LayoutParams addressParams = matchWrap();
        addressParams.topMargin = dp(10);
        page.addView(serverAddress, addressParams);

        errorMessage = text("", 13, Color.rgb(255, 142, 142), false);
        LinearLayout.LayoutParams errorParams = matchWrap();
        errorParams.topMargin = dp(8);
        page.addView(errorMessage, errorParams);

        Button continueButton = new Button(this);
        continueButton.setText("Open BudgetFlow");
        continueButton.setTextSize(16);
        continueButton.setTextColor(Color.WHITE);
        continueButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        continueButton.setAllCaps(false);
        continueButton.setBackground(roundRect(ACCENT, dp(12)));
        LinearLayout.LayoutParams buttonParams = matchWrap();
        buttonParams.topMargin = dp(16);
        page.addView(continueButton, buttonParams);
        continueButton.setOnClickListener(view -> openServer());
        serverAddress.setOnEditorActionListener((view, actionId, event) -> {
            openServer();
            return true;
        });

        scroll.addView(page, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT,
                ScrollView.LayoutParams.WRAP_CONTENT));
        return scroll;
    }

    private void openServer() {
        String value = serverAddress.getText().toString().trim();
        if (value.isEmpty()) {
            showError("Enter your server's HTTPS address.");
            return;
        }

        if (value.matches("(?i)^http://.*") || (value.contains("://") && !value.matches("(?i)^https://.*"))) {
            showError("Use the HTTPS address for your server.");
            return;
        }
        if (!value.matches("(?i)^https://.*")) {
            value = "https://" + value;
        }

        Uri uri = Uri.parse(value);
        if (!"https".equalsIgnoreCase(uri.getScheme())
                || uri.getHost() == null
                || uri.getHost().isEmpty()
                || uri.getUserInfo() != null
                || uri.getQuery() != null
                || uri.getFragment() != null) {
            showError("Enter a valid HTTPS address, such as https://budget.example.com.");
            return;
        }

        String normalized = value;
        while (normalized.endsWith("/") && uri.getPath() != null && uri.getPath().length() <= 1) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putString(PREF_SERVER_URL, normalized)
                .apply();

        launchWebActivity(normalized);
    }

    private void launchWebActivity(String serverUrl) {
        startActivity(new Intent(this, WebActivity.class).putExtra(WebActivity.EXTRA_URL, serverUrl));
        finish();
    }

    private void showError(String message) {
        errorMessage.setText(message);
        serverAddress.requestFocus();
    }

    private TextView text(String value, int sizeSp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private GradientDrawable roundRect(int color, int radiusPx) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radiusPx);
        return drawable;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
