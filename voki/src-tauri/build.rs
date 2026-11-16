fn main() {
    // App commands are declared explicitly so the capability can grant them
    // to the Voki web page (remote URL) as well as to the bundled start page.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["set_due_count", "stash_migration", "take_migration"]),
        ),
    )
    .expect("failed to run tauri-build");
}
