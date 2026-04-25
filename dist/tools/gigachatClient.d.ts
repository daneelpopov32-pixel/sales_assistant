export declare class GigaChatClient {
    private accessToken;
    private tokenExpiry;
    private httpsAgent;
    private generateUUID;
    private authenticate;
    chat(messages: Array<{
        role: string;
        content: string;
    }>, temperature?: number): Promise<string>;
}
//# sourceMappingURL=gigachatClient.d.ts.map