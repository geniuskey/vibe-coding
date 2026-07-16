// 연습용 미니 SPI 마스터 (mode 0, 단일 바이트)
// rtl-helper 스킬 실습: 포트 요약 / TB 생성 / 룰 체크 대상
// 주의: R02 위반(래치 추론 위험)이 일부러 심어져 있다 — 찾아보세요.
module spi_master #(
    parameter CLK_DIV = 4,
    parameter DATA_W  = 8
) (
    input  wire              clk,
    input  wire              rst_n,
    input  wire              start,
    input  wire [DATA_W-1:0] tx_data,
    input  wire              miso,
    output reg               busy,
    output reg               done,
    output reg  [DATA_W-1:0] rx_data,
    output reg               sclk,
    output wire              mosi,
    output reg               cs_n
);

    localparam IDLE = 2'd0, XFER = 2'd1, STOP = 2'd2;

    reg [1:0]          state;
    reg [DATA_W-1:0]   tx_shift;
    reg [DATA_W-1:0]   rx_shift;
    reg [3:0]          bit_cnt;
    reg [7:0]          div_cnt;

    assign mosi = tx_shift[DATA_W-1];

    // 일부러 심은 룰 위반: 조합 블록에서 else 누락 (R02, latch 추론 위험)
    reg tick;
    always @(*) begin
        if (div_cnt == CLK_DIV - 1)
            tick = 1'b1;
        // else 누락 — rtl-helper 린트가 잡아야 함
    end

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state    <= IDLE;
            busy     <= 1'b0;
            done     <= 1'b0;
            sclk     <= 1'b0;
            cs_n     <= 1'b1;
            bit_cnt  <= 4'd0;
            div_cnt  <= 8'd0;
            tx_shift <= {DATA_W{1'b0}};
            rx_shift <= {DATA_W{1'b0}};
            rx_data  <= {DATA_W{1'b0}};
        end else begin
            done <= 1'b0;
            case (state)
                IDLE: if (start) begin
                    state    <= XFER;
                    busy     <= 1'b1;
                    cs_n     <= 1'b0;
                    tx_shift <= tx_data;
                    bit_cnt  <= 4'd0;
                    div_cnt  <= 8'd0;
                end
                XFER: begin
                    if (div_cnt == CLK_DIV - 1) begin
                        div_cnt <= 8'd0;
                        sclk    <= ~sclk;
                        if (sclk) begin // falling edge: shift out
                            tx_shift <= {tx_shift[DATA_W-2:0], 1'b0};
                            if (bit_cnt == DATA_W - 1) state <= STOP;
                            bit_cnt <= bit_cnt + 4'd1;
                        end else begin  // rising edge: sample in
                            rx_shift <= {rx_shift[DATA_W-2:0], miso};
                        end
                    end else begin
                        div_cnt <= div_cnt + 8'd1;
                    end
                end
                STOP: begin
                    cs_n    <= 1'b1;
                    busy    <= 1'b0;
                    done    <= 1'b1;
                    rx_data <= rx_shift;
                    state   <= IDLE;
                end
                default: state <= IDLE;
            endcase
        end
    end

endmodule
