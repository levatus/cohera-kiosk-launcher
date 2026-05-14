export {};

declare module "react-native-webview/lib/WebViewTypes" {
  interface WebViewPermissionRequest {
    resources: string[];
    grant(resources: string[]): void;
    deny(): void;
  }

  interface AndroidWebViewProps {
    onPermissionRequest?: (request: WebViewPermissionRequest) => void;
  }
}
