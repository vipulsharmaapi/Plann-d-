## verdict

1. Auth validation — resolved. The re-read auth-validation-mobile.png shows the concise email-format error directly beneath the affected input without overlapping the form. AuthSheet.tsx now associates known email, credential/password and invalid/expired-code failures with stable field IDs and aria-invalid/aria-describedby, and focuses the affected field. Unknown, connection, capacity and profile/gender failures remain general role=alert messages rather than falsely invalidating fields. tests/auth-flow.test.tsx verifies malformed-email association, expired-code association/focus, and general capacity/network failures leaving valid fields unmarked. The parent reports the full 90-test check and build pass, plus the focused auth tests after adding the focus assertion.
2. Product/design persistence — resolved. PRODUCT.md now identifies the final Live UX improvements handoff/Figma entry and current screenshot packet, describes the panorama separately from the four retained activity images, and records the shared picker/account/avatar behavior. DESIGN.md now records the same authority and the actual 660px post dialog, 790px picker, and full-height phone surfaces. The sidecar descriptions agree with those corrected dimensions and behavior.
3. Actual 200% browser zoom — resolved in the preceding scoring pass. browser-zoom-evidence.json records native Chrome AX confirmation of 200%, Retina devicePixelRatio 4, 855px CSS viewport with no overflowing discovery or post controls, a scrollable 423px-high dialog, and keyboard focus reaching Post your plan after 623.25px dialog scrolling. The focused action remains entirely within the 462px viewport. The known clipped zoom screenshot is not used as visual-fidelity evidence.

## remaining

Clear. No regressions from the correction batch were established. This ship verdict covers the scored fixes, not the whole surface.

disposition: ship
