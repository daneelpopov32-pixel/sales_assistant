export declare class SupportAgent {
    private gigachat;
    private examples;
    private orderDb;
    constructor();
    private loadExamples;
    private loadDefaultExamples;
    private findRelevantExamples;
    private extractClientName;
    private detectIntent;
    private formatOrdersListInline;
    private handleOrderCountQuery;
    private handleOrderQuery;
    private detectStageTransition;
    private getStageInstruction;
    processMessage(sessionId: string, userMessage: string): Promise<string>;
    private getFallbackResponse;
}
//# sourceMappingURL=supportAgent.d.ts.map