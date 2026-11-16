// Hide the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};

const TRAY_ID: &str = "voki-tray";

/// Bring the main window back from the tray and focus it.
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Called by the frontend (`setDueBadge`) whenever the number of due cards changes.
#[tauri::command]
fn set_due_count(app: AppHandle, count: u32) -> Result<(), String> {
    let text = if count == 0 {
        "Voki – alles erledigt".to_string()
    } else {
        format!("Voki – {count} fällig")
    };
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_tooltip(Some(&text)).map_err(|e| e.to_string())?;
        // Tray titles are only shown on macOS/Linux; Windows ignores them.
        #[cfg(not(target_os = "windows"))]
        let _ = tray.set_title(Some(&text));
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        // Starting Voki again while it sits in the tray brings the existing window back.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main_window(app)))
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Voki öffnen", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;

            let mut tray = TrayIconBuilder::with_id(TRAY_ID)
                .tooltip("Voki")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window hides it to the tray; „Beenden“ in the tray menu quits.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![set_due_count])
        .run(tauri::generate_context!())
        .expect("Voki konnte nicht gestartet werden");
}
